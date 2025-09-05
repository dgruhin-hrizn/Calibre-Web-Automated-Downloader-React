"""Backend logic for the book download application."""

import threading, time
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import subprocess
import os
import json
import requests
import re
from concurrent.futures import ThreadPoolExecutor, Future
from threading import Event

from ..infrastructure.logger import setup_logger
from ..infrastructure.config import CUSTOM_SCRIPT
from ..infrastructure.env import INGEST_DIR, TMP_DIR, MAIN_LOOP_SLEEP_TIME, USE_BOOK_TITLE, MAX_CONCURRENT_DOWNLOADS, DOWNLOAD_PROGRESS_UPDATE_INTERVAL
from .models import book_queue, BookInfo, QueueStatus, SearchFilters
from . import book_manager

# Import conversion system
from ..infrastructure.app_settings import get_app_settings
from ..core.conversion_manager import get_conversion_manager

logger = setup_logger(__name__)

def _sanitize_filename(filename: str) -> str:
    """Sanitize a filename by replacing spaces with underscores and removing invalid characters."""
    keepcharacters = (' ','.','_')
    return "".join(c for c in filename if c.isalnum() or c in keepcharacters).rstrip()

def search_books(query: str, filters: SearchFilters) -> List[Dict[str, Any]]:
    """Search for books matching the query.
    
    Args:
        query: Search term
        filters: Search filters object
        
    Returns:
        List[Dict]: List of book information dictionaries
    """
    try:
        books = book_manager.search_books(query, filters)
        return [_book_info_to_dict(book) for book in books]
    except Exception as e:
        logger.error_trace(f"Error searching books: {e}")
        return []

def get_book_info(book_id: str) -> Optional[Dict[str, Any]]:
    """Get detailed information for a specific book.
    
    Args:
        book_id: Book identifier
        
    Returns:
        Optional[Dict]: Book information dictionary if found
    """
    try:
        book = book_manager.get_book_info(book_id)
        return _book_info_to_dict(book)
    except Exception as e:
        logger.error_trace(f"Error getting book info: {e}")
        return None

def queue_book(book_id: str, priority: int = 0, username: str = None, search_url: str = None, cover_url: str = None) -> bool:
    """Add a book to the download queue with specified priority.
    
    Args:
        book_id: Book identifier
        priority: Priority level (lower number = higher priority)
        username: Username for tracking downloads per user
        search_url: Original search URL for the book
        cover_url: Book cover image URL from search results
        
    Returns:
        bool: True if book was successfully queued
    """
    try:
        book_info = book_manager.get_book_info(book_id)
        # If we have a cover URL from frontend, use it to override the book info
        if cover_url and book_info:
            book_info.preview = cover_url
        book_queue.add(book_id, book_info, priority, username, search_url)
        logger.info(f"Book queued with priority {priority} for user {username}: {book_info.title}")
        return True
    except Exception as e:
        logger.error_trace(f"Error queueing book: {e}")
        return False

def queue_status() -> Dict[str, Dict[str, Any]]:
    """Get current status of the download queue.
    
    Returns:
        Dict: Queue status organized by status type
    """
    status = book_queue.get_status()
    # Convert Enum keys to strings and properly format the response
    return {
        status_type.value: books
        for status_type, books in status.items()
    }

def get_book_data(book_id: str) -> Tuple[Optional[bytes], BookInfo]:
    """Get book data for a specific book, including its title.
    
    Args:
        book_id: Book identifier
        
    Returns:
        Tuple[Optional[bytes], str]: Book data if available, and the book title
    """
    try:
        book_info = book_queue._book_data[book_id]
        path = book_info.download_path
        with open(path, "rb") as f:
            return f.read(), book_info
    except Exception as e:
        logger.error_trace(f"Error getting book data: {e}")
        if book_info:
            book_info.download_path = None
        # NEVER create phantom entries - if we don't have valid book_info, fail completely
        if book_info and hasattr(book_info, 'title') and book_info.title and book_info.title != "Unknown":
            return None, book_info
        else:
            logger.error(f"PHANTOM PREVENTION: Refusing to create fallback BookInfo for {book_id}")
            raise Exception(f"No valid book data available for {book_id}")

def _book_info_to_dict(book: BookInfo) -> Dict[str, Any]:
    """Convert BookInfo object to dictionary representation."""
    return {
        key: value for key, value in book.__dict__.items()
        if value is not None
    }

def _download_book_with_cancellation(book_id: str, cancel_flag: Event) -> Optional[str]:
    """Download and process a book with cancellation support.
    
    Args:
        book_id: Book identifier
        cancel_flag: Threading event to signal cancellation
        
    Returns:
        str: Path to the downloaded book if successful, None otherwise
    """
    try:
        # Check for cancellation before starting
        if cancel_flag.is_set():
            logger.info(f"Download cancelled before starting: {book_id}")
            return None
            
        book_info = book_queue._book_data[book_id]
        logger.info(f"Starting download: {book_info.title}")

        if USE_BOOK_TITLE:
            book_name = _sanitize_filename(book_info.title)
        else:
            book_name = book_id
        book_name += f".{book_info.format}"
        book_path = TMP_DIR / book_name

        # Check cancellation before download
        if cancel_flag.is_set():
            logger.info(f"Download cancelled before book manager call: {book_id}")
            return None
        
        progress_callback = lambda progress, speed=None, eta=None: update_download_progress(book_id, progress, speed, eta)
        success = book_manager.download_book(book_info, book_path, progress_callback, cancel_flag)
        
        # Stop progress updates
        cancel_flag.wait(0.1)  # Brief pause for progress thread cleanup
        
        if cancel_flag.is_set():
            logger.info(f"Download cancelled during download: {book_id}")
            # Clean up partial download
            if book_path.exists():
                book_path.unlink()
            return None
            
        if not success:
            raise Exception("Unknown error downloading book")

        # Check cancellation before post-processing
        if cancel_flag.is_set():
            logger.info(f"Download cancelled before post-processing: {book_id}")
            if book_path.exists():
                book_path.unlink()
            return None

        if CUSTOM_SCRIPT:
            logger.info(f"Running custom script: {CUSTOM_SCRIPT}")
            subprocess.run([CUSTOM_SCRIPT, book_path])
        
        if os.path.exists(book_path):
            # Check if conversion is enabled and needed
            settings = get_app_settings()
            conversion_needed = (
                settings.conversion.enabled and
                book_path.suffix.lower().lstrip('.') != settings.conversion.target_format.lower() and
                book_path.suffix.lower().lstrip('.') in [fmt.lower() for fmt in settings.conversion.supported_formats]
            )
            
            if conversion_needed:
                logger.info(f"Queuing book for conversion: {book_info.title}")
                
                # Check cancellation before queuing conversion
                if cancel_flag.is_set():
                    logger.info(f"Download cancelled before conversion queue: {book_id}")
                    if book_path.exists():
                        book_path.unlink()
                    return None
                
                try:
                    # Get conversion manager and queue the conversion
                    import asyncio
                    
                    # Get or create event loop
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    conversion_manager = loop.run_until_complete(get_conversion_manager())
                    
                    # Create book metadata for conversion
                    book_metadata = {
                        'title': book_info.title,
                        'author': book_info.author,
                        'isbn': getattr(book_info, 'isbn', None),
                        'published_date': getattr(book_info, 'published_date', None),
                        'language': getattr(book_info, 'language', None),
                        'tags': getattr(book_info, 'tags', []),
                        'description': getattr(book_info, 'description', None),
                        'cover_url': getattr(book_info, 'cover_url', None),
                    }
                    
                    # Get user ID from current session/context (simplified for now)
                    user_id = "admin"  # TODO: Get actual user ID from context
                    
                    # Queue for conversion
                    job_id = loop.run_until_complete(conversion_manager.queue_conversion(
                        book_id=book_id,
                        input_file=book_path,
                        book_metadata=book_metadata,
                        user_id=user_id
                    ))
                    
                    if job_id:
                        logger.info(f"Book queued for conversion with job ID: {job_id}")
                        # Return the original file path - conversion will handle library addition
                        return str(book_path)
                    else:
                        logger.warning(f"Conversion not queued, falling back to direct library addition")
                        # Fall through to direct library addition
                        
                except Exception as e:
                    logger.error(f"Error queuing conversion for {book_id}: {e}")
                    logger.info("Falling back to direct library addition without conversion")
                    # Fall through to direct library addition
            
            # Direct library addition (no conversion needed or conversion failed)
            return _add_original_to_library(book_id, book_path, book_info, cancel_flag)
        
        return None
    except Exception as e:
        if cancel_flag.is_set():
            logger.info(f"Download cancelled during error handling: {book_id}")
        else:
            logger.error_trace(f"Error downloading book: {e}")
        return None

def _add_original_to_library(book_id: str, book_path: Path, book_info: BookInfo, cancel_flag: Event) -> Optional[str]:
    """Add the original downloaded book to the library without conversion.
    
    This preserves the original ingest directory workflow.
    """
    try:
        # Use original book name logic
        if USE_BOOK_TITLE:
            book_name = _sanitize_filename(book_info.title)
        else:
            book_name = book_id
        book_name += f".{book_info.format}"
        
        intermediate_path = INGEST_DIR / f"{book_id}.crdownload"
        final_path = INGEST_DIR / book_name
        
        logger.info(f"Moving book to ingest directory: {book_path} -> {final_path}")
        
        try:
            shutil.move(book_path, intermediate_path)
        except Exception as e:
            try:
                logger.debug(f"Error moving book: {e}, will try copying instead")
                shutil.move(book_path, intermediate_path)
            except Exception as e:
                logger.debug(f"Error copying book: {e}, will try copying without permissions instead")
                shutil.copyfile(book_path, intermediate_path)
            os.remove(book_path)
        
        # Final cancellation check before completing
        if cancel_flag.is_set():
            logger.info(f"Download cancelled before final rename: {book_id}")
            if intermediate_path.exists():
                intermediate_path.unlink()
            return None
            
        os.rename(intermediate_path, final_path)
        logger.info(f"Download completed successfully: {book_info.title}")
        
        return str(final_path)
        
    except Exception as e:
        logger.error(f"Error adding book to library: {e}")
        return None

def update_download_progress(book_id: str, progress: float, speed: str = None, eta: int = None) -> None:
    """Update download progress with speed and ETA."""
    # Transition from PROCESSING to DOWNLOADING on first progress update
    current_status = book_queue.get_status_for_book(book_id)
    if current_status == QueueStatus.PROCESSING:
        book_queue.update_status(book_id, QueueStatus.DOWNLOADING)
    
    book_queue.update_progress(book_id, progress, speed, eta)
    
def update_download_wait_time(book_id: str, wait_time: int, wait_start: float) -> None:
    """Update the waiting time information for a book."""
    book_queue.update_wait_time(book_id, wait_time, wait_start)

def cancel_download(book_id: str) -> bool:
    """Cancel a download.
    
    Args:
        book_id: Book identifier to cancel
        
    Returns:
        bool: True if cancellation was successful
    """
    return book_queue.cancel_download(book_id)

def force_cancel_download(book_id: str) -> bool:
    """Force cancel a download regardless of status.
    
    Args:
        book_id: Book identifier to force cancel
        
    Returns:
        bool: True if force cancellation was successful
    """
    return book_queue.force_cancel_download(book_id)

def remove_from_tracking(book_id: str) -> None:
    """Remove a book from all tracking systems.
    Always succeeds - used for cleaning up phantom entries.
    
    Args:
        book_id: Book identifier to remove from tracking
    """
    book_queue.remove_from_tracking(book_id)

def set_book_priority(book_id: str, priority: int) -> bool:
    """Set priority for a queued book.
    
    Args:
        book_id: Book identifier
        priority: New priority level (lower = higher priority)
        
    Returns:
        bool: True if priority was successfully changed
    """
    return book_queue.set_priority(book_id, priority)

def reorder_queue(book_priorities: Dict[str, int]) -> bool:
    """Bulk reorder queue.
    
    Args:
        book_priorities: Dict mapping book_id to new priority
        
    Returns:
        bool: True if reordering was successful
    """
    return book_queue.reorder_queue(book_priorities)

def get_queue_order() -> List[Dict[str, any]]:
    """Get current queue order for display."""
    return book_queue.get_queue_order()

def get_active_downloads() -> List[str]:
    """Get list of currently active downloads."""
    return book_queue.get_active_downloads()

def clear_completed() -> int:
    """Clear all completed downloads from tracking."""
    return book_queue.clear_completed()

def cleanup_phantom_entries() -> int:
    """Clean up phantom queue entries with incomplete metadata."""
    return book_queue.cleanup_phantom_entries()

def _process_single_download(book_id: str, cancel_flag: Event) -> None:
    """Process a single download job."""
    try:
        book_queue.update_status(book_id, QueueStatus.PROCESSING)
        download_path = _download_book_with_cancellation(book_id, cancel_flag)
        
        if cancel_flag.is_set():
            book_queue.update_status(book_id, QueueStatus.CANCELLED)
            return
            
        if download_path:
            book_queue.update_download_path(book_id, download_path)
            # Get file size for database update
            from pathlib import Path
            file_size = None
            try:
                if Path(download_path).exists():
                    file_size = Path(download_path).stat().st_size
            except Exception as e:
                logger.warning(f"Could not get file size for {download_path}: {e}")
            
            # Update status with file information for database
            book_queue.update_status(book_id, QueueStatus.AVAILABLE, 
                                   file_path=download_path, 
                                   file_size=file_size)
        else:
            book_queue.update_status(book_id, QueueStatus.ERROR)
        
        logger.info(
            f"Book {book_id} download {'successful' if download_path else 'failed'}"
        )
        
    except Exception as e:
        if not cancel_flag.is_set():
            logger.error_trace(f"Error in download processing: {e}")
            book_queue.update_status(book_id, QueueStatus.ERROR)
        else:
            logger.info(f"Download cancelled: {book_id}")
            book_queue.update_status(book_id, QueueStatus.CANCELLED)

def concurrent_download_loop() -> None:
    """Main download coordinator using ThreadPoolExecutor for concurrent downloads."""
    logger.info(f"Starting concurrent download loop with {MAX_CONCURRENT_DOWNLOADS} workers")
    
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_DOWNLOADS, thread_name_prefix="BookDownload") as executor:
        active_futures: Dict[Future, str] = {}  # Track active download futures
        
        while True:
            # Clean up completed futures
            completed_futures = [f for f in active_futures if f.done()]
            for future in completed_futures:
                book_id = active_futures.pop(future)
                try:
                    future.result()  # This will raise any exceptions from the worker
                except Exception as e:
                    logger.error_trace(f"Future exception for {book_id}: {e}")
            
            # Start new downloads if we have capacity
            while len(active_futures) < MAX_CONCURRENT_DOWNLOADS:
                next_download = book_queue.get_next()
                if not next_download:
                    break
                    
                book_id, cancel_flag = next_download
                logger.info(f"Starting concurrent download: {book_id}")
                
                # Submit download job to thread pool
                future = executor.submit(_process_single_download, book_id, cancel_flag)
                active_futures[future] = book_id
            
            # Brief sleep to prevent busy waiting
            time.sleep(MAIN_LOOP_SLEEP_TIME)

# Start concurrent download coordinator
download_coordinator_thread = threading.Thread(
    target=concurrent_download_loop,
    daemon=True,
    name="DownloadCoordinator"
)
download_coordinator_thread.start()

logger.info(f"Download system initialized with {MAX_CONCURRENT_DOWNLOADS} concurrent workers")

# Google Books API integration
GOOGLE_BOOKS_SETTINGS_FILE = Path(__file__).parent / "google_books_settings.json"

def get_google_books_settings() -> Dict[str, Any]:
    """Get current Google Books API settings."""
    try:
        if GOOGLE_BOOKS_SETTINGS_FILE.exists():
            with open(GOOGLE_BOOKS_SETTINGS_FILE, 'r') as f:
                settings = json.load(f)
                return {
                    "apiKey": settings.get("apiKey", ""),
                    "isValid": settings.get("isValid", False),
                    "lastChecked": settings.get("lastChecked", "")
                }
    except Exception as e:
        logger.error_trace(f"Error loading Google Books settings: {e}")
    
    return {"apiKey": "", "isValid": False, "lastChecked": ""}

def save_google_books_settings(api_key: str, is_valid: bool) -> None:
    """Save Google Books API settings."""
    try:
        logger.info(f"Attempting to save Google Books settings to: {GOOGLE_BOOKS_SETTINGS_FILE}")
        settings = {
            "apiKey": api_key,
            "isValid": is_valid,
            "lastChecked": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        with open(GOOGLE_BOOKS_SETTINGS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)
        logger.info(f"Google Books API settings saved successfully to: {GOOGLE_BOOKS_SETTINGS_FILE}")
    except Exception as e:
        logger.error_trace(f"Error saving Google Books settings to {GOOGLE_BOOKS_SETTINGS_FILE}: {e}")
        raise

def test_google_books_api_key(api_key: str) -> bool:
    """Test if Google Books API key is valid."""
    if not api_key.strip():
        return False
    
    try:
        # Test the API key with a simple query
        response = requests.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={
                "q": "python programming",
                "maxResults": 1,
                "key": api_key
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            # Check if we got valid response structure
            return "items" in data or "totalItems" in data
        else:
            logger.warning(f"Google Books API test failed with status {response.status_code}")
            return False
            
    except Exception as e:
        logger.error_trace(f"Error testing Google Books API key: {e}")
        return False

def find_best_google_books_match(items: List[Dict[str, Any]], target_title: str, target_author: str = "") -> Optional[Dict[str, Any]]:
    """
    Evaluate multiple Google Books results and return the one with the most complete data.
    
    Args:
        items: List of Google Books items
        target_title: The title we're looking for
        target_author: The author we're looking for
    
    Returns:
        The best matching book item, or None if no good match found
    """
    if not items:
        return None
    
    if len(items) == 1:
        return items[0]
    
    logger.info(f"Evaluating {len(items)} Google Books results to find best match")
    
    best_book = None
    best_score = -1
    
    for i, book in enumerate(items):
        volume_info = book.get("volumeInfo", {})
        
        # Calculate completeness score based on available data
        score = 0
        data_points = []
        
        # Core information (higher weight)
        if volume_info.get("title"):
            score += 10
            data_points.append("title")
        if volume_info.get("authors"):
            score += 10
            data_points.append("authors")
        
        # Rich content (high value)
        description = volume_info.get("description", "")
        if description and len(description) > 100:
            score += 25  # High value for substantial descriptions
            data_points.append("description")
        elif description:
            score += 10  # Some value for short descriptions
        
        # Metadata (medium value)
        if volume_info.get("categories"):
            score += 15
            data_points.append("categories")
        if volume_info.get("publisher"):
            score += 8
            data_points.append("publisher")
        if volume_info.get("publishedDate"):
            score += 8
            data_points.append("publishedDate")
        if volume_info.get("pageCount"):
            score += 5
            data_points.append("pageCount")
        
        # User engagement data (medium value)
        if volume_info.get("averageRating"):
            score += 12
            data_points.append("averageRating")
        if volume_info.get("ratingsCount"):
            score += 10
            data_points.append("ratingsCount")
        
        # Images and links (lower value but useful)
        if volume_info.get("imageLinks"):
            score += 5
            data_points.append("imageLinks")
        if volume_info.get("previewLink"):
            score += 3
            data_points.append("previewLink")
        if volume_info.get("infoLink"):
            score += 3
            data_points.append("infoLink")
        
        # Industry identifiers (useful for matching)
        if volume_info.get("industryIdentifiers"):
            score += 7
            data_points.append("industryIdentifiers")
        
        logger.info(f"Book {i+1}: title='{volume_info.get('title', 'N/A')}', score={score}, data_points={data_points}")
        
        if score > best_score:
            best_score = score
            best_book = book
    
    logger.info(f"Selected book with score {best_score}: '{best_book.get('volumeInfo', {}).get('title', 'N/A')}'")
    return best_book


def search_google_books(title: str, author: str = "", api_key: str = "", max_results: int = 1, projection: str = "full") -> Optional[Dict[str, Any]]:
    """Search Google Books API for book information."""
    logger.info(f"search_google_books called with title='{title}', author='{author}'")
    
    if not api_key:
        settings = get_google_books_settings()
        api_key = settings.get("apiKey", "")
        logger.info(f"Using API key from settings: {'[CONFIGURED]' if api_key else '[NOT CONFIGURED]'}")
        
        if not api_key or not settings.get("isValid", False):
            logger.warning(f"Google Books API not available: api_key={bool(api_key)}, is_valid={settings.get('isValid', False)}")
            return None
    
    try:
        # Build search query - try multiple approaches for better matching
        queries_to_try = []
        
        # Query 1: Exact title and author
        if title and author:
            queries_to_try.append(f'intitle:"{title}" inauthor:"{author}"')
        
        # Query 2: Just title if author search fails
        if title:
            queries_to_try.append(f'intitle:"{title}"')
        
        # Query 3: Author-only search (for "More by Author" functionality)
        if author and not title:
            queries_to_try.append(f'inauthor:"{author}"')
            
        # Query 4: General search as fallback
        if title and author:
            queries_to_try.append(f'"{title}" "{author}"')
        elif title:
            queries_to_try.append(f'"{title}"')
        elif author:
            queries_to_try.append(f'"{author}"')
        
        if not queries_to_try:
            logger.warning("No search queries could be built")
            return None
        
        for i, query in enumerate(queries_to_try):
            logger.info(f"Trying Google Books query {i+1}/{len(queries_to_try)}: {query}")
            
            response = requests.get(
                "https://www.googleapis.com/books/v1/volumes",
                params={
                    "q": query,
                    "maxResults": max_results if max_results > 1 else 5,
                    "projection": projection,
                    "printType": "books",
                    "langRestrict": "en",  # Restrict to English language books
                    "key": api_key
                },
                timeout=10
            )
            
            logger.info(f"Google Books API response: status={response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Google Books API response data keys: {list(data.keys())}")
                
                if "items" in data and data["items"]:
                    logger.info(f"Found {len(data['items'])} book(s) in Google Books")
                    
                    # If requesting multiple results, return the full response
                    if max_results > 1:
                        logger.info(f"Returning {len(data['items'])} books for author search")
                        return data
                    else:
                        # Single book request - find the best match from all results
                        best_book = find_best_google_books_match(data["items"], title, author)
                        if best_book:
                            volume_info = best_book.get("volumeInfo", {})
                            search_info = best_book.get("searchInfo", {})
                            logger.info(f"Selected book: title='{volume_info.get('title')}', authors={volume_info.get('authors')}")
                            logger.info(f"Available volumeInfo keys: {list(volume_info.keys())}")
                            logger.info(f"Available searchInfo keys: {list(search_info.keys())}")
                            logger.info(f"Available top-level keys: {list(best_book.keys())}")
                            
                            # Log some specific fields we're interested in
                            logger.info(f"Categories: {volume_info.get('categories')}")
                            logger.info(f"Publisher: {volume_info.get('publisher')}")
                            logger.info(f"Published Date: {volume_info.get('publishedDate')}")
                            logger.info(f"Page Count: {volume_info.get('pageCount')}")
                            logger.info(f"Language: {volume_info.get('language')}")
                            logger.info(f"Description length: {len(volume_info.get('description', ''))}")
                            logger.info(f"Average Rating: {volume_info.get('averageRating')}")
                            logger.info(f"Ratings Count: {volume_info.get('ratingsCount')}")
                            
                            return best_book
                        else:
                            # Fallback to first book if evaluation fails
                            logger.warning("Best match evaluation failed, falling back to first result")
                            return data["items"][0]
                else:
                    logger.info(f"No books found with query: {query}")
            else:
                logger.warning(f"Google Books API search failed with status {response.status_code}: {response.text}")
        
        logger.info("All Google Books queries failed to find results")
        return None
            
    except Exception as e:
        logger.error_trace(f"Error searching Google Books: {e}")
        return None

def get_google_books_volume_details(volume_id: str, api_key: str = "") -> Optional[Dict[str, Any]]:
    """Get detailed information about a specific Google Books volume by ID."""
    if not api_key:
        settings = get_google_books_settings()
        api_key = settings.get("apiKey", "")
        if not api_key or not settings.get("isValid", False):
            logger.warning("Google Books API not available for volume details")
            return None
    
    try:
        logger.info(f"Fetching detailed volume info for ID: {volume_id}")
        
        response = requests.get(
            f"https://www.googleapis.com/books/v1/volumes/{volume_id}",
            params={
                "projection": "full",
                "key": api_key
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Volume details retrieved successfully for {volume_id}")
            
            # Log additional fields that might be available in detailed view
            volume_info = data.get("volumeInfo", {})
            logger.info(f"Detailed volumeInfo keys: {list(volume_info.keys())}")
            
            # Check for additional fields
            if "mainCategory" in volume_info:
                logger.info(f"Main Category: {volume_info.get('mainCategory')}")
            if "subjects" in volume_info:
                logger.info(f"Subjects: {volume_info.get('subjects')}")
            if "industryIdentifiers" in volume_info:
                logger.info(f"Industry Identifiers: {volume_info.get('industryIdentifiers')}")
            
            return data
        else:
            logger.warning(f"Failed to get volume details: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error_trace(f"Error getting Google Books volume details: {e}")
        return None

def search_bookinfo_pro(title: str, author: str = "", max_results: int = 1):
    """
    Search for book data using the rreading-glasses API at api.bookinfo.pro
    Based on Goodreads-compatible API structure
    """
    logger.info(f"Searching bookinfo.pro for: '{title}' by '{author}'")
    
    try:
        # Clean up the search terms
        clean_title = re.sub(r'[^\w\s]', ' ', title).strip()
        clean_author = re.sub(r'[^\w\s]', ' ', author).strip() if author else ""
        
        # Try different search strategies
        search_queries = []
        
        # Strategy 1: Title + Author
        if clean_author:
            search_queries.append(f"{clean_title} {clean_author}")
        
        # Strategy 2: Just title if author search fails
        search_queries.append(clean_title)
        
        # Strategy 3: Try with series info removed
        title_without_series = re.sub(r'\s*\([^)]*\)\s*$', '', clean_title).strip()
        if title_without_series != clean_title:
            if clean_author:
                search_queries.append(f"{title_without_series} {clean_author}")
            search_queries.append(title_without_series)
        
        for query in search_queries:
            logger.info(f"Trying bookinfo.pro search query: '{query}'")
            
            # Use the EXACT endpoints that Readarr uses (found from source code analysis)
            endpoints_to_try = [
                # Strategy 1: Readarr's auto_complete search endpoint (JSON)
                {
                    'url': 'https://api.bookinfo.pro/book/auto_complete',
                    'params': {'format': 'json', 'q': query}
                },
                # Strategy 2: Try the working basic search as fallback
                {
                    'url': 'https://api.bookinfo.pro/search',
                    'params': {'q': query}
                }
            ]
            
            for i, endpoint in enumerate(endpoints_to_try, 1):
                logger.info(f"Trying bookinfo.pro endpoint {i}/2: {endpoint['url']}")
                
                try:
                    response = requests.get(
                        endpoint['url'],
                        params=endpoint['params'],
                        timeout=10,
                        headers={
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
                            'Accept': 'application/json, application/xml, text/xml, */*'
                        }
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"bookinfo.pro endpoint {i} returned 200, content-type: {response.headers.get('content-type', 'unknown')}")
                        
                        # Try to parse as JSON first
                        try:
                            data = response.json()
                            logger.info(f"bookinfo.pro search successful (JSON) from endpoint {i}: {type(data)}")
                            return data
                        except:
                            # If not JSON, log the response for debugging
                            content_preview = response.text[:200] + "..." if len(response.text) > 200 else response.text
                            logger.info(f"bookinfo.pro endpoint {i} returned non-JSON data: {content_preview}")
                            continue
                    else:
                        logger.warning(f"bookinfo.pro endpoint {i} failed with status {response.status_code}")
                        continue
                        
                except Exception as e:
                    logger.warning(f"bookinfo.pro endpoint {i} failed with error: {e}")
                    continue
                
        logger.warning("All bookinfo.pro search queries and endpoints failed")
        return None
        
    except Exception as e:
        logger.error(f"Error searching bookinfo.pro: {e}")
        return None

def get_bookinfo_pro_work(work_id: str):
    """
    Get detailed work information from bookinfo.pro using work ID
    Try multiple endpoint strategies since we don't know the exact API structure
    """
    logger.info(f"Getting bookinfo.pro work details for ID: {work_id}")
    
    # Use the EXACT endpoint that Readarr uses for book details
    endpoints_to_try = [
        # Strategy 1: Readarr's basic_book_data endpoint (the one Readarr actually uses)
        {
            'url': f'https://api.bookinfo.pro/api/book/basic_book_data/{work_id}',
            'params': {'format': 'xml', 'key': 'dummy'}
        },
        # Strategy 2: Try with JSON format
        {
            'url': f'https://api.bookinfo.pro/api/book/basic_book_data/{work_id}',
            'params': {'format': 'json', 'key': 'dummy'}
        }
    ]
    
    for i, endpoint in enumerate(endpoints_to_try, 1):
        logger.info(f"Trying bookinfo.pro work endpoint {i}/2: {endpoint['url']}")
        
        try:
            response = requests.get(
                endpoint['url'],
                params=endpoint['params'],
                timeout=10,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
                    'Accept': 'application/json, application/xml, text/xml, */*'
                }
            )
            
            if response.status_code == 200:
                logger.info(f"bookinfo.pro work endpoint {i} returned 200, content-type: {response.headers.get('content-type', 'unknown')}")
                
                # Try to parse as JSON first
                try:
                    data = response.json()
                    logger.info(f"bookinfo.pro work data retrieved successfully from endpoint {i}: {type(data)}")
                    return data
                except:
                    # If not JSON, log the response for debugging
                    content_preview = response.text[:200] + "..." if len(response.text) > 200 else response.text
                    logger.info(f"bookinfo.pro work endpoint {i} returned non-JSON data: {content_preview}")
                    continue
            else:
                logger.warning(f"bookinfo.pro work endpoint {i} failed with status {response.status_code}")
                continue
                
        except Exception as e:
            logger.warning(f"bookinfo.pro work endpoint {i} failed with error: {e}")
            continue
    
    logger.warning("All bookinfo.pro work endpoints failed")
    return None

def get_bookinfo_pro_author(author_id: str):
    """
    Get detailed author information from bookinfo.pro using author ID
    Uses Goodreads-compatible API structure
    """
    logger.info(f"Getting bookinfo.pro author details for ID: {author_id}")
    
    # Use Goodreads-compatible API endpoints for author details
    endpoints_to_try = [
        # Strategy 1: Goodreads author show endpoint with .xml
        {
            'url': f'https://api.bookinfo.pro/author/show/{author_id}.xml',
            'params': {'key': 'dummy'}
        },
        # Strategy 2: Try without .xml extension
        {
            'url': f'https://api.bookinfo.pro/author/show/{author_id}',
            'params': {'key': 'dummy', 'format': 'json'}
        }
    ]
    
    for i, endpoint in enumerate(endpoints_to_try, 1):
        logger.info(f"Trying bookinfo.pro author endpoint {i}/2: {endpoint['url']}")
        
        try:
            response = requests.get(
                endpoint['url'],
                params=endpoint['params'],
                timeout=10,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
                    'Accept': 'application/json, application/xml, text/xml, */*'
                }
            )
            
            if response.status_code == 200:
                logger.info(f"bookinfo.pro author endpoint {i} returned 200, content-type: {response.headers.get('content-type', 'unknown')}")
                
                # Try to parse as JSON first
                try:
                    data = response.json()
                    logger.info(f"bookinfo.pro author data retrieved successfully from endpoint {i}: {type(data)}")
                    return data
                except:
                    # If not JSON, log the response for debugging
                    content_preview = response.text[:200] + "..." if len(response.text) > 200 else response.text
                    logger.info(f"bookinfo.pro author endpoint {i} returned non-JSON data: {content_preview}")
                    continue
            else:
                logger.warning(f"bookinfo.pro author endpoint {i} failed with status {response.status_code}")
                continue
                
        except Exception as e:
            logger.warning(f"bookinfo.pro author endpoint {i} failed with error: {e}")
            continue
    
    logger.warning("All bookinfo.pro author endpoints failed")
    return None




def get_enhanced_book_details(book_id: str, basic_book_info: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Get enhanced book details combining local data with Google Books API data.
    
    Args:
        book_id: The book identifier
        basic_book_info: Optional pre-fetched basic book info to avoid re-fetching
    """
    try:
        logger.info(f"Getting enhanced book details for book_id: {book_id}")
        
        # Use provided basic book info or fetch it if not provided
        if basic_book_info:
            logger.info("Using provided basic book info (avoiding re-fetch)")
        else:
            logger.info("Fetching basic book info")
            basic_book_info = get_book_info(book_id)
            if not basic_book_info:
                logger.warning(f"Could not get basic book info for book_id: {book_id}")
                return None
        
        logger.info(f"Got basic book info: title='{basic_book_info.get('title')}', author='{basic_book_info.get('author')}')")
        
        # Start with basic book info (this is already a dictionary)
        enhanced_details = basic_book_info.copy()
        
        # Check if Google Books API is configured and valid before trying to use it
        google_settings = get_google_books_settings()
        if not google_settings.get("apiKey") or not google_settings.get("isValid"):
            logger.info("Google Books API not configured or invalid, returning basic book details only")
            return enhanced_details
        
        # First, get data from Google Books API for clean, standardized information
        google_data = search_google_books(
            title=basic_book_info.get("title", ""),
            author=basic_book_info.get("author", "")
        )
        
        # Use Anna's Archive data as primary source, enhanced with Google Books API
        
        if google_data:
            logger.info(f"Found Google Books data for '{basic_book_info.get('title')}'")
            volume_info = google_data.get("volumeInfo", {})
            
            # Add Google Books data
            enhanced_details["googleBooks"] = {
                "description": volume_info.get("description", ""),
                "categories": volume_info.get("categories", []),
                "averageRating": volume_info.get("averageRating"),
                "ratingsCount": volume_info.get("ratingsCount"),
                "pageCount": volume_info.get("pageCount"),
                "publishedDate": volume_info.get("publishedDate", ""),
                "industryIdentifiers": volume_info.get("industryIdentifiers", []),
                "imageLinks": volume_info.get("imageLinks", {}),
                "infoLink": volume_info.get("infoLink", ""),
                "previewLink": volume_info.get("previewLink", "")
            }
            
            # Use Google Books cover if local one is not available
            if not enhanced_details.get("preview") and volume_info.get("imageLinks"):
                image_links = volume_info["imageLinks"]
                # Prefer higher resolution images
                for size in ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"]:
                    if size in image_links:
                        enhanced_details["preview"] = image_links[size]
                        break
        else:
            logger.info(f"No Google Books data found for '{basic_book_info.get('title')}'")
            # Still return basic details without Google Books data
        
        # Anna's Archive data is already in enhanced_details as the base
        # Google Books data enhances it with additional metadata
        
        return enhanced_details
        
    except Exception as e:
        logger.error_trace(f"Error getting enhanced book details: {e}")
        return None
