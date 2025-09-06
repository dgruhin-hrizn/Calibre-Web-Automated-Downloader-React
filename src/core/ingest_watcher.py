"""
Ingest Directory Watcher
Monitors the ingest directory for new files and triggers processing.
Based on CWA reference implementation using watchdog for cross-platform compatibility.
"""

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Set, Optional

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileMovedEvent

from ..infrastructure.env import INGEST_DIR
from .ingest_processor import process_ingest_file
from .models import BookInfo

logger = logging.getLogger(__name__)


class IngestEventHandler(FileSystemEventHandler):
    """Handles file system events in the ingest directory"""
    
    # Supported book formats (based on CWA reference)
    SUPPORTED_EXTENSIONS = {
        'epub', 'mobi', 'azw3', 'azw', 'pdf', 'txt', 'rtf', 
        'cbz', 'cbr', 'cb7', 'cbc', 'fb2', 'fbz', 'docx', 
        'html', 'htmlz', 'lit', 'lrf', 'odt', 'prc', 'pdb', 
        'pml', 'rb', 'snb', 'tcr', 'txtz', 'kepub', 'm4b', 
        'm4a', 'mp4'
    }
    
    # Temporary file suffixes to ignore
    TEMP_SUFFIXES = {
        'crdownload', 'download', 'part', 'uploading', 'tmp'
    }
    
    def __init__(self):
        super().__init__()
        self.processing_files: Set[str] = set()
        
    def on_created(self, event):
        """Handle file creation events"""
        if not event.is_directory:
            self._handle_file_event(event.src_path)
    
    def on_moved(self, event):
        """Handle file move events (e.g., rename from .crdownload to .epub)"""
        if not event.is_directory:
            self._handle_file_event(event.dest_path)
    
    def _handle_file_event(self, file_path: str):
        """Process a file system event"""
        try:
            path = Path(file_path)
            
            # Skip if already processing this file
            if file_path in self.processing_files:
                return
            
            # Check if it's a temporary file
            if self._is_temp_file(path):
                logger.debug(f"Ignoring temporary file: {path.name}")
                return
            
            # Check if it's a supported format
            if not self._is_supported_format(path):
                logger.debug(f"Ignoring unsupported file format: {path.name}")
                return
            
            logger.info(f"New file detected in ingest directory: {path.name}")
            
            # Wait for file to be stable (fully written)
            if not self._wait_for_stable_file(path):
                logger.warning(f"File did not become stable or disappeared: {path.name}")
                return
            
            # Mark as processing
            self.processing_files.add(file_path)
            
            # Process the file asynchronously
            asyncio.create_task(self._process_file_async(path))
            
        except Exception as e:
            logger.error(f"Error handling file event for {file_path}: {e}")
    
    def _is_temp_file(self, path: Path) -> bool:
        """Check if file has a temporary suffix"""
        # Check for temp suffixes
        for suffix in self.TEMP_SUFFIXES:
            if path.name.endswith(f'.{suffix}'):
                return True
        
        # Check for hidden files
        if path.name.startswith('.'):
            return True
            
        return False
    
    def _is_supported_format(self, path: Path) -> bool:
        """Check if file format is supported for ingestion"""
        extension = path.suffix.lower().lstrip('.')
        return extension in self.SUPPORTED_EXTENSIONS
    
    def _wait_for_stable_file(self, path: Path, max_checks: int = 6, interval: float = 0.5) -> bool:
        """Wait for file to be stable (not being written to)"""
        if not path.exists():
            return False
        
        last_size = None
        stable_count = 0
        
        for _ in range(max_checks):
            try:
                current_size = path.stat().st_size
                
                if current_size == last_size:
                    stable_count += 1
                    if stable_count >= 2:  # File stable for 2 consecutive checks
                        return True
                else:
                    stable_count = 0
                    last_size = current_size
                
                time.sleep(interval)
                
            except (OSError, FileNotFoundError):
                # File disappeared or can't be accessed
                return False
        
        # File exists but may still be growing - proceed anyway
        return True
    
    async def _process_file_async(self, path: Path):
        """Process a file asynchronously"""
        try:
            # Extract basic book info from filename
            book_info = self._extract_book_info_from_filename(path)
            
            # Process the file
            success = await process_ingest_file(path, book_info)
            
            if success:
                logger.info(f"Successfully processed: {path.name}")
            else:
                logger.error(f"Failed to process: {path.name}")
                
        except Exception as e:
            logger.error(f"Error processing file {path.name}: {e}")
        finally:
            # Remove from processing set
            self.processing_files.discard(str(path))
    
    def _extract_book_info_from_filename(self, path: Path) -> BookInfo:
        """Extract basic book information from filename"""
        # This is a fallback - ideally we'd have full metadata from the download
        # For now, try to parse title and author from filename
        name = path.stem
        
        # Try to split by common patterns
        title = name
        author = "Unknown"
        
        # Look for patterns like "Author - Title" or "Title - Author"
        if ' - ' in name:
            parts = name.split(' - ', 1)
            if len(parts) == 2:
                # Assume first part is author, second is title
                author, title = parts
        
        # Get format from file extension
        format_ext = path.suffix.lower().lstrip('.')
        
        return BookInfo(
            title=title.strip(),
            author=author.strip(),
            format=format_ext,
            source_url="",  # Not available from filename
            cover_url=None
        )


class IngestWatcher:
    """Monitors the ingest directory for new files"""
    
    def __init__(self, ingest_dir: Optional[Path] = None):
        self.ingest_dir = ingest_dir or INGEST_DIR
        self.observer = None
        self.event_handler = None
        self.running = False
        
    async def start(self):
        """Start monitoring the ingest directory"""
        if self.running:
            logger.warning("Ingest watcher is already running")
            return
        
        # Ensure ingest directory exists
        self.ingest_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Starting ingest watcher on: {self.ingest_dir}")
        
        # Set up file system observer
        self.event_handler = IngestEventHandler()
        self.observer = Observer()
        self.observer.schedule(
            self.event_handler, 
            str(self.ingest_dir), 
            recursive=True
        )
        
        # Start observer
        self.observer.start()
        self.running = True
        
        logger.info("Ingest watcher started successfully")
        
        # Process any existing files in the directory
        await self._process_existing_files()
    
    async def stop(self):
        """Stop monitoring the ingest directory"""
        if not self.running:
            return
        
        logger.info("Stopping ingest watcher")
        
        if self.observer:
            self.observer.stop()
            self.observer.join()
        
        self.running = False
        logger.info("Ingest watcher stopped")
    
    async def _process_existing_files(self):
        """Process any files that already exist in the ingest directory"""
        try:
            for file_path in self.ingest_dir.rglob('*'):
                if file_path.is_file():
                    self.event_handler._handle_file_event(str(file_path))
        except Exception as e:
            logger.error(f"Error processing existing files: {e}")


# Global watcher instance
_watcher = None

async def get_ingest_watcher() -> IngestWatcher:
    """Get the global ingest watcher instance"""
    global _watcher
    if _watcher is None:
        _watcher = IngestWatcher()
    return _watcher

async def start_ingest_watcher():
    """Start the global ingest watcher"""
    watcher = await get_ingest_watcher()
    await watcher.start()

async def stop_ingest_watcher():
    """Stop the global ingest watcher"""
    global _watcher
    if _watcher:
        await _watcher.stop()
        _watcher = None
