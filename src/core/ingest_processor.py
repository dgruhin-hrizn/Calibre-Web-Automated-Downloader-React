"""
Ingest Processor
Handles book ingestion into the Calibre library after download completion.
Based on CWA reference implementation but simplified for our use case.
"""

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any

from ..infrastructure.env import CALIBRE_LIBRARY_PATH
from ..infrastructure.app_settings import get_app_settings
from .models import BookInfo

logger = logging.getLogger(__name__)


class IngestProcessor:
    """Processes downloaded books and adds them to the Calibre library"""
    
    def __init__(self):
        self.library_path = CALIBRE_LIBRARY_PATH
        self.settings = get_app_settings()
        
    def _get_calibre_env(self) -> Dict[str, str]:
        """Get environment variables for Calibre commands"""
        env = os.environ.copy()
        # Ensure Calibre can find its binaries
        calibre_path = "/opt/calibre/bin"
        if os.path.exists(calibre_path):
            env["PATH"] = f"{calibre_path}:{env.get('PATH', '')}"
        return env
        
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for filesystem compatibility"""
        # Remove/replace invalid characters
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        return filename.strip()
    
    async def process_book(self, file_path: Path, book_info: BookInfo) -> bool:
        """Process a book file and add it to the Calibre library"""
        try:
            logger.info(f"Starting ingestion process for: {file_path.name}")
            
            # Check if library directory exists
            if not self.library_path.exists():
                logger.error(f"Calibre library path does not exist: {self.library_path}")
                return False
            
            # Determine if conversion is needed
            file_ext = file_path.suffix.lower().lstrip('.')
            target_format = self.settings.conversion.target_format.lower()
            needs_conversion = (
                self.settings.conversion.enabled and 
                file_ext != target_format and
                file_ext in [fmt.lower() for fmt in self.settings.conversion.supported_formats]
            )
            
            if needs_conversion:
                logger.info(f"Converting {file_path.name} from {file_ext} to {target_format}")
                converted_path = await self._convert_book(file_path, target_format, book_info)
                if converted_path:
                    import_path = converted_path
                else:
                    logger.warning(f"Conversion failed, importing original file: {file_path.name}")
                    import_path = file_path
            else:
                logger.info(f"No conversion needed for {file_path.name}, importing directly")
                import_path = file_path
            
            # Add book to Calibre library
            success = await self._add_to_library(import_path, book_info)
            
            # Cleanup temporary files
            if needs_conversion and converted_path and converted_path != file_path:
                try:
                    converted_path.unlink()
                    logger.debug(f"Cleaned up converted file: {converted_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup converted file: {e}")
            
            # Remove original file from ingest directory
            try:
                file_path.unlink()
                logger.info(f"Removed processed file from ingest: {file_path.name}")
            except Exception as e:
                logger.warning(f"Failed to remove ingest file: {e}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error processing book {file_path.name}: {e}")
            return False
    
    async def _convert_book(self, input_path: Path, target_format: str, book_info: BookInfo) -> Optional[Path]:
        """Convert book to target format using Calibre's ebook-convert"""
        try:
            # Create temporary output file
            with tempfile.NamedTemporaryFile(suffix=f'.{target_format}', delete=False) as tmp_file:
                output_path = Path(tmp_file.name)
            
            # Build ebook-convert command
            cmd = [
                'ebook-convert',
                str(input_path),
                str(output_path),
                '--authors', book_info.author or 'Unknown',
                '--title', book_info.title or 'Unknown',
            ]
            
            # Add optional metadata
            if hasattr(book_info, 'isbn') and book_info.isbn:
                cmd.extend(['--isbn', book_info.isbn])
            if hasattr(book_info, 'language') and book_info.language:
                cmd.extend(['--language', book_info.language])
            if hasattr(book_info, 'tags') and book_info.tags:
                cmd.extend(['--tags', ', '.join(book_info.tags)])
            if hasattr(book_info, 'description') and book_info.description:
                cmd.extend(['--comments', book_info.description])
            
            logger.debug(f"Running conversion command: {' '.join(cmd)}")
            
            # Run conversion
            env = self._get_calibre_env()
            process = await asyncio.create_subprocess_exec(
                *cmd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.info(f"Successfully converted {input_path.name} to {target_format}")
                return output_path
            else:
                logger.error(f"Conversion failed for {input_path.name}: {stderr.decode()}")
                # Cleanup failed conversion file
                if output_path.exists():
                    output_path.unlink()
                return None
                
        except Exception as e:
            logger.error(f"Error during conversion: {e}")
            return None
    
    async def _add_to_library(self, file_path: Path, book_info: BookInfo) -> bool:
        """Add book to Calibre library using calibredb"""
        try:
            # Build calibredb add command
            cmd = [
                'calibredb', 'add',
                str(file_path),
                f'--library-path={self.library_path}',
                '--automerge', 'overwrite',  # Handle duplicates by overwriting
            ]
            
            # Add metadata if available
            if book_info.author:
                cmd.extend(['--authors', book_info.author])
            if book_info.title:
                cmd.extend(['--title', book_info.title])
            
            logger.debug(f"Running calibredb command: {' '.join(cmd)}")
            
            # Run calibredb add
            env = self._get_calibre_env()
            process = await asyncio.create_subprocess_exec(
                *cmd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.info(f"Successfully added {file_path.name} to Calibre library")
                # Parse output to get book ID if needed
                output_text = stdout.decode().strip()
                logger.debug(f"calibredb output: {output_text}")
                return True
            else:
                logger.error(f"Failed to add {file_path.name} to library: {stderr.decode()}")
                return False
                
        except Exception as e:
            logger.error(f"Error adding book to library: {e}")
            return False


# Global processor instance
_processor = None

async def get_ingest_processor() -> IngestProcessor:
    """Get the global ingest processor instance"""
    global _processor
    if _processor is None:
        _processor = IngestProcessor()
    return _processor


async def process_ingest_file(file_path: Path, book_info: BookInfo) -> bool:
    """Process a single file in the ingest directory"""
    processor = await get_ingest_processor()
    return await processor.process_book(file_path, book_info)
