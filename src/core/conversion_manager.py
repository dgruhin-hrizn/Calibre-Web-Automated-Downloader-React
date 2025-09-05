"""
Book Conversion Manager

Handles format conversion using Calibre and manages the Calibre library directly.
This provides independence from CWA by managing our own Calibre library.
"""

import asyncio
import logging
import os
import shutil
import sqlite3
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict, Any, Callable
import uuid

from ..infrastructure.app_settings import get_app_settings
from ..infrastructure.downloads_db import DownloadsDBManager

logger = logging.getLogger(__name__)


@dataclass
class ConversionJob:
    """Represents a book conversion job"""
    job_id: str
    book_id: str  # Anna's Archive hash
    input_file: Path
    output_format: str
    book_metadata: Dict[str, Any]
    user_id: str
    callback: Optional[Callable[[str, str], None]] = None  # callback(job_id, status)


class CalibreLibraryManager:
    """Manages direct interaction with Calibre library"""
    
    def __init__(self, library_path: str = "/calibre-library"):
        self.library_path = Path(library_path)
        self.metadata_db = self.library_path / "metadata.db"
        
    def initialize_library(self) -> bool:
        """Initialize Calibre library if it doesn't exist"""
        try:
            if not self.library_path.exists():
                logger.info(f"Creating Calibre library at {self.library_path}")
                self.library_path.mkdir(parents=True, exist_ok=True)
                
            if not self.metadata_db.exists():
                logger.info("Initializing Calibre metadata database")
                # Use calibredb to initialize the library
                result = subprocess.run([
                    "calibredb", "list", 
                    "--library-path", str(self.library_path)
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode != 0:
                    logger.error(f"Failed to initialize Calibre library: {result.stderr}")
                    return False
                    
            logger.info(f"Calibre library ready at {self.library_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Calibre library: {e}")
            return False
    
    def add_book(self, file_path: Path, metadata: Dict[str, Any]) -> Optional[str]:
        """Add book to Calibre library using calibredb"""
        try:
            if not self.initialize_library():
                return None
                
            cmd = [
                "calibredb", "add",
                "--library-path", str(self.library_path),
                str(file_path)
            ]
            
            # Add metadata if available
            if metadata.get('title'):
                cmd.extend(["--title", metadata['title']])
            if metadata.get('author'):
                cmd.extend(["--authors", metadata['author']])
            if metadata.get('isbn'):
                cmd.extend(["--isbn", metadata['isbn']])
            if metadata.get('published_date'):
                cmd.extend(["--pubdate", str(metadata['published_date'])])
            if metadata.get('language'):
                cmd.extend(["--languages", metadata['language']])
            if metadata.get('tags'):
                if isinstance(metadata['tags'], list):
                    cmd.extend(["--tags", ",".join(metadata['tags'])])
                else:
                    cmd.extend(["--tags", str(metadata['tags'])])
                    
            logger.info(f"Adding book to Calibre library: {file_path.name}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                # Extract book ID from output
                output_lines = result.stdout.strip().split('\n')
                for line in output_lines:
                    if "Added book ids:" in line:
                        book_id = line.split(":")[-1].strip()
                        logger.info(f"Book added to Calibre library with ID: {book_id}")
                        return book_id
                        
                logger.info("Book added to Calibre library successfully")
                return "success"
            else:
                logger.error(f"Failed to add book to Calibre library: {result.stderr}")
                return None
                
        except Exception as e:
            logger.error(f"Error adding book to Calibre library: {e}")
            return None
    
    def remove_book(self, calibre_id: str) -> bool:
        """Remove book from Calibre library"""
        try:
            cmd = [
                "calibredb", "remove",
                "--library-path", str(self.library_path),
                calibre_id
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                logger.info(f"Removed book {calibre_id} from Calibre library")
                return True
            else:
                logger.error(f"Failed to remove book {calibre_id}: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error removing book from Calibre library: {e}")
            return False
    
    def get_library_stats(self) -> Dict[str, Any]:
        """Get library statistics"""
        try:
            if not self.metadata_db.exists():
                return {"total_books": 0, "formats": {}}
                
            with sqlite3.connect(str(self.metadata_db)) as conn:
                cursor = conn.cursor()
                
                # Get total books
                cursor.execute("SELECT COUNT(*) FROM books")
                total_books = cursor.fetchone()[0]
                
                # Get format distribution
                cursor.execute("""
                    SELECT format, COUNT(*) 
                    FROM data 
                    GROUP BY format 
                    ORDER BY COUNT(*) DESC
                """)
                formats = dict(cursor.fetchall())
                
                return {
                    "total_books": total_books,
                    "formats": formats
                }
                
        except Exception as e:
            logger.error(f"Error getting library stats: {e}")
            return {"total_books": 0, "formats": {}}


class ConversionManager:
    """Manages book format conversion using Calibre"""
    
    def __init__(self):
        self.conversion_queue = asyncio.Queue()
        self.active_jobs: Dict[str, ConversionJob] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)  # Will be configurable
        self.library_manager = CalibreLibraryManager()
        # We'll get the downloads DB manager from the global instance
        self.downloads_db = None
        self.running = False
        
    async def start(self):
        """Start the conversion manager"""
        if self.running:
            return
            
        logger.info("Starting conversion manager")
        self.running = True
        
        # Initialize Calibre library
        if not self.library_manager.initialize_library():
            logger.error("Failed to initialize Calibre library")
            return False
            
        # Start worker tasks
        settings = get_app_settings()
        num_workers = settings.downloads.max_concurrent_conversions
        
        for i in range(num_workers):
            asyncio.create_task(self._conversion_worker(f"worker-{i}"))
            
        logger.info(f"Conversion manager started with {num_workers} workers")
        return True
    
    async def stop(self):
        """Stop the conversion manager"""
        if not self.running:
            return
            
        logger.info("Stopping conversion manager")
        self.running = False
        
        # Cancel active jobs
        for job_id in list(self.active_jobs.keys()):
            await self._update_job_status(job_id, "cancelled")
            
        # Shutdown executor
        self.executor.shutdown(wait=True)
        logger.info("Conversion manager stopped")
    
    async def queue_conversion(self, 
                             book_id: str,
                             input_file: Path, 
                             book_metadata: Dict[str, Any],
                             user_id: str,
                             callback: Optional[Callable[[str, str], None]] = None) -> str:
        """Queue a book for conversion"""
        settings = get_app_settings()
        
        if not settings.conversion.enabled:
            logger.info("Conversion is disabled, skipping")
            return None
            
        if not self._should_convert(input_file):
            logger.info(f"File {input_file.suffix} doesn't need conversion")
            return None
            
        job_id = str(uuid.uuid4())
        job = ConversionJob(
            job_id=job_id,
            book_id=book_id,
            input_file=input_file,
            output_format=settings.conversion.target_format,
            book_metadata=book_metadata,
            user_id=user_id,
            callback=callback
        )
        
        self.active_jobs[job_id] = job
        await self.conversion_queue.put(job)
        
        logger.info(f"Queued conversion job {job_id} for {input_file.name}")
        return job_id
    
    def _should_convert(self, file_path: Path) -> bool:
        """Check if file needs conversion"""
        settings = get_app_settings()
        
        if not settings.conversion.enabled:
            return False
            
        file_ext = file_path.suffix.lower().lstrip('.')
        target_format = settings.conversion.target_format.lower()
        
        # Don't convert if already in target format
        if file_ext == target_format:
            return False
            
        # Check if format is supported for conversion
        return file_ext in [fmt.lower() for fmt in settings.conversion.supported_formats]
    
    async def _conversion_worker(self, worker_name: str):
        """Worker that processes conversion jobs"""
        logger.info(f"Conversion worker {worker_name} started")
        
        while self.running:
            try:
                # Wait for a job with timeout
                job = await asyncio.wait_for(self.conversion_queue.get(), timeout=1.0)
                
                logger.info(f"Worker {worker_name} processing job {job.job_id}")
                await self._update_job_status(job.job_id, "processing")
                
                # Process the job in thread pool
                loop = asyncio.get_event_loop()
                success = await loop.run_in_executor(
                    self.executor,
                    self._process_conversion,
                    job
                )
                
                if success:
                    await self._update_job_status(job.job_id, "completed")
                else:
                    await self._update_job_status(job.job_id, "failed")
                    
            except asyncio.TimeoutError:
                continue  # No jobs available, keep waiting
            except Exception as e:
                logger.error(f"Conversion worker {worker_name} error: {e}")
                if 'job' in locals():
                    await self._update_job_status(job.job_id, "failed")
                    
        logger.info(f"Conversion worker {worker_name} stopped")
    
    def _process_conversion(self, job: ConversionJob) -> bool:
        """Process a single conversion job (runs in thread pool)"""
        try:
            settings = get_app_settings()
            
            # Create temporary output file
            with tempfile.NamedTemporaryFile(
                suffix=f".{job.output_format}",
                delete=False
            ) as temp_output:
                output_path = Path(temp_output.name)
            
            try:
                # Build ebook-convert command
                cmd = [
                    "ebook-convert",
                    str(job.input_file),
                    str(output_path)
                ]
                
                # Add conversion options based on settings
                if settings.conversion.preserve_cover:
                    cmd.extend(["--preserve-cover-aspect-ratio"])
                    
                if settings.conversion.preserve_metadata:
                    cmd.extend(["--preserve-metadata"])
                    
                # Quality settings
                if job.output_format.lower() == "epub":
                    if settings.conversion.quality == "high":
                        cmd.extend(["--epub-version", "3"])
                    cmd.extend(["--no-default-epub-cover"])
                    
                logger.info(f"Starting conversion: {job.input_file.name} -> {job.output_format}")
                
                # Run conversion with timeout
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=settings.conversion.timeout_seconds
                )
                
                if result.returncode == 0:
                    logger.info(f"Conversion successful: {job.job_id}")
                    
                    # Add converted book to Calibre library
                    calibre_id = self.library_manager.add_book(output_path, job.book_metadata)
                    
                    if calibre_id:
                        # Update download record with library info
                        self._update_download_record(job, str(output_path), calibre_id)
                        return True
                    else:
                        logger.error(f"Failed to add converted book to library: {job.job_id}")
                        return False
                else:
                    logger.error(f"Conversion failed: {result.stderr}")
                    return False
                    
            finally:
                # Clean up temporary file
                if output_path.exists():
                    if settings.downloads.cleanup_temp_files:
                        output_path.unlink()
                        
        except subprocess.TimeoutExpired:
            logger.error(f"Conversion timeout for job {job.job_id}")
            return False
        except Exception as e:
            logger.error(f"Conversion error for job {job.job_id}: {e}")
            return False
    
    def _update_download_record(self, job: ConversionJob, file_path: str, calibre_id: str):
        """Update download record with conversion results"""
        try:
            # Get file size
            file_size = Path(file_path).stat().st_size if Path(file_path).exists() else 0
            
            # Get the global downloads DB manager
            from ..api.app import get_downloads_db_manager
            downloads_db = get_downloads_db_manager()
            
            if downloads_db:
                # Update download status with conversion info
                downloads_db.update_download_status(
                    book_id=job.book_id,
                    user_id=job.user_id,
                    status="completed",
                    file_path=file_path,
                    file_size=file_size,
                    book_metadata={
                        **job.book_metadata,
                        "converted_format": job.output_format,
                        "calibre_id": calibre_id,
                        "conversion_job_id": job.job_id
                    }
                )
                
                logger.info(f"Updated download record for {job.book_id} with conversion info")
            else:
                logger.warning("Downloads DB manager not available for updating record")
            
        except Exception as e:
            logger.error(f"Error updating download record: {e}")
    
    async def _update_job_status(self, job_id: str, status: str):
        """Update job status and notify callback"""
        try:
            if job_id in self.active_jobs:
                job = self.active_jobs[job_id]
                
                if job.callback:
                    job.callback(job_id, status)
                    
                if status in ["completed", "failed", "cancelled"]:
                    # Remove from active jobs
                    del self.active_jobs[job_id]
                    
                logger.debug(f"Job {job_id} status updated to: {status}")
                
        except Exception as e:
            logger.error(f"Error updating job status: {e}")
    
    def get_active_jobs(self) -> Dict[str, Dict[str, Any]]:
        """Get information about active conversion jobs"""
        return {
            job_id: {
                "book_id": job.book_id,
                "input_file": str(job.input_file),
                "output_format": job.output_format,
                "book_title": job.book_metadata.get('title', 'Unknown'),
                "user_id": job.user_id
            }
            for job_id, job in self.active_jobs.items()
        }


# Global conversion manager instance
_conversion_manager: Optional[ConversionManager] = None

async def get_conversion_manager() -> ConversionManager:
    """Get global conversion manager instance"""
    global _conversion_manager
    if _conversion_manager is None:
        _conversion_manager = ConversionManager()
        await _conversion_manager.start()
    return _conversion_manager

async def stop_conversion_manager():
    """Stop global conversion manager"""
    global _conversion_manager
    if _conversion_manager:
        await _conversion_manager.stop()
        _conversion_manager = None
