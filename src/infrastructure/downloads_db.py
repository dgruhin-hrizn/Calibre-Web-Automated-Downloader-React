"""
Downloads Database Manager - Per-user download tracking with URL storage
Manages a separate SQLite database for tracking all Anna's Archive downloads
"""

import sqlite3
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from contextlib import contextmanager
from dataclasses import asdict

from ..core.models import BookInfo, QueueStatus

logger = logging.getLogger(__name__)

class DownloadsDBManager:
    """Manages the downloads.db SQLite database for per-user download tracking"""
    
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        logger.info(f"Downloads database initialized at: {self.db_path}")
    
    def _init_db(self):
        """Initialize the downloads database with required schema"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Main download history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS download_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    book_id TEXT NOT NULL,
                    book_title TEXT,
                    book_author TEXT,
                    book_publisher TEXT,
                    book_year TEXT,
                    book_language TEXT,
                    book_format TEXT,
                    status TEXT CHECK(status IN ('queued', 'processing', 'downloading', 'waiting', 'completed', 'error', 'cancelled')) NOT NULL DEFAULT 'queued',
                    
                    -- Timing information
                    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    download_duration INTEGER, -- seconds
                    
                    -- File information
                    file_size INTEGER,
                    file_path TEXT,
                    expected_size INTEGER, -- From Content-Length header
                    cover_url TEXT,       -- Book cover image URL
                    
                    -- URL tracking (KEY FEATURE)
                    anna_search_url TEXT,     -- Original search/book page URL
                    final_download_url TEXT,  -- Direct download URL
                    url_discovered_at TIMESTAMP,
                    url_expires_at TIMESTAMP, -- If URL has known expiration
                    
                    -- Progress tracking
                    progress_percent INTEGER DEFAULT 0,
                    download_speed TEXT, -- "1.2 MB/s"
                    eta_seconds INTEGER,
                    wait_time INTEGER, -- Total wait time in seconds
                    wait_start TIMESTAMP, -- When waiting started
                    
                    -- Error handling & retry
                    error_message TEXT,
                    retry_count INTEGER DEFAULT 0,
                    can_retry_direct BOOLEAN DEFAULT 0, -- Whether final_download_url is still valid
                    
                    -- Source metadata
                    anna_archive_id TEXT,
                    content_hash TEXT,        -- MD5/SHA for verification
                    book_info_json TEXT,      -- Serialized BookInfo for full context
                    
                    -- Timestamps
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # User preferences table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    username TEXT PRIMARY KEY,
                    preferred_format TEXT DEFAULT 'epub',
                    download_location TEXT,
                    max_concurrent INTEGER DEFAULT 3,
                    auto_retry BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # User statistics cache
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_stats (
                    username TEXT PRIMARY KEY,
                    total_downloads INTEGER DEFAULT 0,
                    successful_downloads INTEGER DEFAULT 0,
                    failed_downloads INTEGER DEFAULT 0,
                    cancelled_downloads INTEGER DEFAULT 0,
                    total_size_bytes INTEGER DEFAULT 0,
                    total_download_time INTEGER DEFAULT 0, -- seconds
                    last_download_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_download_history_username ON download_history(username);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_download_history_status ON download_history(username, status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_download_history_date ON download_history(username, created_at DESC);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_download_history_book ON download_history(book_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_download_history_redownload ON download_history(username, can_retry_direct, final_download_url);")
            
            conn.commit()
            logger.info("Downloads database schema initialized successfully")
            
            # Handle schema migrations
            self._migrate_schema()
    
    def _migrate_schema(self):
        """Handle database schema migrations"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Check if cover_url column exists
            cursor.execute("PRAGMA table_info(download_history)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'cover_url' not in columns:
                logger.info("Adding cover_url column to download_history table")
                cursor.execute("ALTER TABLE download_history ADD COLUMN cover_url TEXT")
                conn.commit()
                logger.info("Schema migration completed: added cover_url column")
                
        except Exception as e:
            logger.error(f"Schema migration error: {e}")
            if conn:
                conn.rollback()
        finally:
            if conn:
                conn.close()
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper error handling"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row  # Enable column access by name
            conn.execute("PRAGMA foreign_keys = ON")  # Enable foreign key constraints
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def record_download_queued(self, username: str, book_info: BookInfo, search_url: str = None) -> int:
        """Record a new download when it's added to the queue"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            book_info_json = json.dumps(asdict(book_info)) if book_info else None
            
            cursor.execute("""
                INSERT INTO download_history (
                    username, book_id, book_title, book_author, book_publisher, 
                    book_year, book_language, book_format, status, anna_search_url,
                    cover_url, book_info_json, queued_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                username, book_info.id, book_info.title, book_info.author,
                book_info.publisher, book_info.year, book_info.language, 
                book_info.format, 'queued', search_url, book_info.preview,
                book_info_json, datetime.now(timezone.utc)
            ))
            
            download_id = cursor.lastrowid
            conn.commit()
            
            # Update user stats
            self._update_user_stats(username)
            
            logger.info(f"Recorded queued download for user {username}: {book_info.title} (ID: {download_id})")
            return download_id
    
    def update_download_status(self, download_id: int, status: str, **kwargs):
        """Update download status and related fields"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Build dynamic update query
            update_fields = ["status = ?", "updated_at = ?"]
            params = [status, datetime.now(timezone.utc)]
            
            # Handle status-specific timestamps
            if status == 'downloading' and 'started_at' not in kwargs:
                update_fields.append("started_at = ?")
                params.append(datetime.now(timezone.utc))
            elif status in ['completed', 'error', 'cancelled'] and 'completed_at' not in kwargs:
                update_fields.append("completed_at = ?")
                params.append(datetime.now(timezone.utc))
            
            # Add any additional fields from kwargs
            for field, value in kwargs.items():
                if field in ['progress_percent', 'download_speed', 'eta_seconds', 'error_message', 
                           'file_size', 'file_path', 'download_duration', 'wait_time', 'wait_start']:
                    update_fields.append(f"{field} = ?")
                    params.append(value)
            
            params.append(download_id)
            
            query = f"UPDATE download_history SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()
            
            # Update user stats if status changed to final state
            if status in ['completed', 'error', 'cancelled']:
                record = self.get_download_record(download_id)
                if record:
                    self._update_user_stats(record['username'])
    
    def update_download_urls(self, download_id: int, search_url: str = None, 
                           final_url: str = None, discovered_at: datetime = None):
        """Update URL information for a download"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            update_fields = ["updated_at = ?"]
            params = [datetime.now(timezone.utc)]
            
            if search_url:
                update_fields.append("anna_search_url = ?")
                params.append(search_url)
            
            if final_url:
                update_fields.append("final_download_url = ?")
                update_fields.append("url_discovered_at = ?")
                update_fields.append("can_retry_direct = ?")
                params.extend([final_url, discovered_at or datetime.now(timezone.utc), 1])
            
            params.append(download_id)
            
            query = f"UPDATE download_history SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()
    
    def mark_url_verified(self, download_id: int, final_url: str):
        """Mark a final URL as verified working"""
        self.update_download_urls(download_id, final_url=final_url)
    
    def mark_url_failed(self, download_id: int, error_msg: str):
        """Mark a URL as failed and disable direct retry"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE download_history 
                SET can_retry_direct = 0, error_message = ?, updated_at = ?
                WHERE id = ?
            """, (error_msg, datetime.now(timezone.utc), download_id))
            conn.commit()
    
    def get_download_record(self, download_id: int, username: str = None) -> Optional[Dict]:
        """Get a single download record by ID, optionally filtered by username for security"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if username:
                # Secure version - only return record if user owns it
                cursor.execute("SELECT * FROM download_history WHERE id = ? AND username = ?", (download_id, username))
            else:
                # Fallback for internal use - should be avoided
                cursor.execute("SELECT * FROM download_history WHERE id = ?", (download_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_user_downloads(self, username: str, status: str = None, limit: int = 50, 
                          offset: int = 0) -> List[Dict]:
        """Get user's download history with optional filtering"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM download_history WHERE username = ?"
            params = [username]
            
            if status:
                query += " AND status = ?"
                params.append(status)
            
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def get_user_downloads_by_status(self, username: str) -> Dict[str, List[Dict]]:
        """Get user's downloads grouped by status"""
        downloads = self.get_user_downloads(username, limit=1000)  # Get more for status grouping
        
        grouped = {
            'queued': [],
            'processing': [],
            'downloading': [],
            'waiting': [],
            'completed': [],
            'error': [],
            'cancelled': []
        }
        
        for download in downloads:
            status = download['status']
            if status in grouped:
                grouped[status].append(download)
        
        return grouped
    
    def get_redownloadable_books(self, username: str, book_id: str = None) -> List[Dict]:
        """Get books that can be re-downloaded directly"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT id, book_title, book_author, final_download_url, book_format, 
                       expected_size, file_size, created_at
                FROM download_history 
                WHERE username = ? 
                AND final_download_url IS NOT NULL 
                AND can_retry_direct = 1
                AND status IN ('completed', 'error')
            """
            params = [username]
            
            if book_id:
                query += " AND book_id = ?"
                params.append(book_id)
            
            query += " ORDER BY created_at DESC"
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def get_user_stats(self, username: str) -> Dict:
        """Get or calculate user statistics"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Try to get cached stats first
            cursor.execute("SELECT * FROM user_stats WHERE username = ?", (username,))
            cached_stats = cursor.fetchone()
            
            if cached_stats:
                return dict(cached_stats)
            
            # Calculate fresh stats
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_downloads,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_downloads,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_downloads,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_downloads,
                    SUM(CASE WHEN file_size IS NOT NULL THEN file_size ELSE 0 END) as total_size_bytes,
                    SUM(CASE WHEN download_duration IS NOT NULL THEN download_duration ELSE 0 END) as total_download_time,
                    MAX(completed_at) as last_download_at
                FROM download_history 
                WHERE username = ?
            """, (username,))
            
            stats = dict(cursor.fetchone())
            stats['username'] = username
            stats['updated_at'] = datetime.now(timezone.utc)
            
            # Cache the calculated stats
            self._cache_user_stats(username, stats)
            
            return stats
    
    def _update_user_stats(self, username: str):
        """Recalculate and cache user statistics"""
        stats = self.get_user_stats(username)  # This will recalculate
        logger.debug(f"Updated stats for user {username}: {stats['total_downloads']} total downloads")
    
    def _cache_user_stats(self, username: str, stats: Dict):
        """Cache calculated user statistics"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO user_stats (
                    username, total_downloads, successful_downloads, failed_downloads,
                    cancelled_downloads, total_size_bytes, total_download_time,
                    last_download_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                username, stats['total_downloads'], stats['successful_downloads'],
                stats['failed_downloads'], stats['cancelled_downloads'],
                stats['total_size_bytes'], stats['total_download_time'],
                stats['last_download_at'], stats['updated_at']
            ))
            conn.commit()
    
    def direct_redownload(self, download_record_id: int, target_path: Path) -> bool:
        """Attempt direct re-download using stored URL"""
        record = self.get_download_record(download_record_id)
        if not record or not record['final_download_url']:
            logger.error(f"No direct download URL available for record {download_record_id}")
            return False
        
        try:
            from ..core.book_manager import _download_from_direct_url
            
            # Attempt direct download
            success = _download_from_direct_url(
                record['final_download_url'],
                target_path,
                expected_size=record['expected_size']
            )
            
            if success:
                self.update_download_status(download_record_id, 'completed', 
                                          file_path=str(target_path),
                                          file_size=target_path.stat().st_size if target_path.exists() else None)
                logger.info(f"Direct re-download successful for record {download_record_id}")
            else:
                self.mark_url_failed(download_record_id, "Direct re-download failed")
                logger.warning(f"Direct re-download failed for record {download_record_id}")
            
            return success
            
        except Exception as e:
            error_msg = f"Direct re-download error: {str(e)}"
            self.mark_url_failed(download_record_id, error_msg)
            logger.error(f"Direct re-download exception for record {download_record_id}: {e}")
            return False
    
    def cleanup_old_records(self, days_old: int = 90):
        """Clean up old download records (optional maintenance)"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cutoff_date = datetime.now(timezone.utc).replace(day=datetime.now().day - days_old)
            
            cursor.execute("""
                DELETE FROM download_history 
                WHERE created_at < ? AND status IN ('completed', 'error', 'cancelled')
            """, (cutoff_date,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} old download records")
            
            return deleted_count
    
    def cancel_phantom_downloads(self, book_id: str) -> int:
        """Cancel phantom downloads that exist in database but not in queue.
        
        Args:
            book_id: Book identifier to cancel
            
        Returns:
            int: Number of downloads cancelled
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Find active downloads for this book_id
            cursor.execute("""
                SELECT id, status FROM download_history 
                WHERE book_id = ? AND status IN ('queued', 'processing', 'downloading', 'waiting')
            """, (book_id,))
            
            active_downloads = cursor.fetchall()
            
            if not active_downloads:
                return 0
            
            # Cancel all active downloads for this book_id
            cursor.execute("""
                UPDATE download_history 
                SET status = 'cancelled', 
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    error_message = 'Cancelled via phantom removal - queue desync detected'
                WHERE book_id = ? AND status IN ('queued', 'processing', 'downloading', 'waiting')
            """, (book_id,))
            
            cancelled_count = cursor.rowcount
            conn.commit()
            
            logger.info(f"Cancelled {cancelled_count} phantom database entries for book_id: {book_id}")
            return cancelled_count
    
    def cleanup_phantom_downloads_on_startup(self) -> int:
        """Clean up phantom downloads on server startup.
        
        Since the download queue has no persistent state, any downloads marked as
        'downloading', 'processing', or 'waiting' are impossible after a restart.
        These are automatically converted to 'cancelled' with appropriate messaging.
        
        Returns:
            int: Number of phantom downloads cleaned up
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Find all impossible states after startup
            cursor.execute("""
                SELECT id, book_id, book_title, status, queued_at 
                FROM download_history 
                WHERE status IN ('downloading', 'processing', 'waiting')
                ORDER BY queued_at DESC
            """)
            
            phantom_downloads = cursor.fetchall()
            
            if not phantom_downloads:
                logger.info("No phantom downloads found during startup cleanup")
                return 0
            
            # Log what we're cleaning up
            logger.info(f"Found {len(phantom_downloads)} phantom downloads during startup cleanup:")
            for download in phantom_downloads:
                logger.info(f"  - ID {download[0]}: {download[2]} ({download[1]}) - was '{download[3]}'")
            
            # Cancel all phantom downloads
            cursor.execute("""
                UPDATE download_history 
                SET status = 'cancelled', 
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    error_message = 'Auto-cancelled on server startup - downloads cannot persist across restarts'
                WHERE status IN ('downloading', 'processing', 'waiting')
            """)
            
            cancelled_count = cursor.rowcount
            conn.commit()
            
            logger.info(f"Startup cleanup: Cancelled {cancelled_count} phantom downloads")
            return cancelled_count
    
    def clear_user_download_history(self, username: str) -> int:
        """Clear all download history for a specific user.
        
        Args:
            username: Username whose history to clear
            
        Returns:
            int: Number of records deleted
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Count records before deletion for logging
            cursor.execute("SELECT COUNT(*) FROM download_history WHERE username = ?", (username,))
            record_count = cursor.fetchone()[0]
            
            if record_count == 0:
                logger.info(f"No download history found for user: {username}")
                return 0
            
            # Delete all download history for the user
            cursor.execute("DELETE FROM download_history WHERE username = ?", (username,))
            deleted_count = cursor.rowcount
            conn.commit()
            
            logger.info(f"Cleared {deleted_count} download history records for user: {username}")
            return deleted_count