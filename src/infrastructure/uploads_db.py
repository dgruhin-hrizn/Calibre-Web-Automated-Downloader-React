"""
Uploads Database Manager - Track file upload history and status
Manages upload records with progress tracking and completion status
"""

import sqlite3
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class UploadsDBManager:
    """Manages the uploads database for tracking file upload history"""
    
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        logger.info(f"Uploads database initialized at: {self.db_path}")
    
    def _init_db(self):
        """Initialize the uploads database with required schema"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Upload history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS upload_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    file_size INTEGER,
                    file_type TEXT,
                    status TEXT CHECK(status IN ('uploading', 'completed', 'failed')) NOT NULL DEFAULT 'uploading',
                    
                    -- Timing information
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    
                    -- Error information
                    error_message TEXT,
                    
                    -- Upload session (for batch uploads)
                    session_id TEXT,
                    
                    UNIQUE(username, filename, started_at)
                )
            """)
            
            # Create indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_upload_username ON upload_history(username)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_upload_session ON upload_history(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_upload_status ON upload_history(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_upload_started_at ON upload_history(started_at)")
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper error handling"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row  # Enable dict-like access
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def create_upload_record(self, username: str, filename: str, original_filename: str, 
                           file_size: int, file_type: str, session_id: str) -> int:
        """Create a new upload record and return the ID"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO upload_history 
                (username, filename, original_filename, file_size, file_type, session_id, status)
                VALUES (?, ?, ?, ?, ?, ?, 'uploading')
            """, (username, filename, original_filename, file_size, file_type, session_id))
            conn.commit()
            return cursor.lastrowid
    
    def update_upload_status(self, upload_id: int, status: str, error_message: str = None):
        """Update upload status and completion time"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if status in ['completed', 'failed']:
                cursor.execute("""
                    UPDATE upload_history 
                    SET status = ?, completed_at = CURRENT_TIMESTAMP, error_message = ?
                    WHERE id = ?
                """, (status, error_message, upload_id))
            else:
                cursor.execute("""
                    UPDATE upload_history 
                    SET status = ?, error_message = ?
                    WHERE id = ?
                """, (status, error_message, upload_id))
            
            conn.commit()
    
    def get_user_uploads(self, username: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent uploads for a user"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    id,
                    filename,
                    original_filename,
                    file_size,
                    file_type,
                    status,
                    started_at,
                    completed_at,
                    error_message,
                    session_id
                FROM upload_history 
                WHERE username = ? 
                ORDER BY started_at DESC 
                LIMIT ?
            """, (username, limit))
            
            uploads = []
            for row in cursor.fetchall():
                upload = dict(row)
                # Format file size
                if upload['file_size']:
                    upload['file_size_formatted'] = self._format_file_size(upload['file_size'])
                uploads.append(upload)
            
            return uploads
    
    def get_session_uploads(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all uploads for a specific session"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    id,
                    filename,
                    original_filename,
                    file_size,
                    file_type,
                    status,
                    started_at,
                    completed_at,
                    error_message
                FROM upload_history 
                WHERE session_id = ? 
                ORDER BY started_at ASC
            """, (session_id,))
            
            uploads = []
            for row in cursor.fetchall():
                upload = dict(row)
                if upload['file_size']:
                    upload['file_size_formatted'] = self._format_file_size(upload['file_size'])
                uploads.append(upload)
            
            return uploads
    
    def cleanup_old_uploads(self, days: int = 30):
        """Remove upload records older than specified days"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM upload_history 
                WHERE started_at < datetime('now', '-{} days')
            """.format(days))
            deleted_count = cursor.rowcount
            conn.commit()
            logger.info(f"Cleaned up {deleted_count} old upload records")
            return deleted_count
    
    def get_upload_stats(self, username: str) -> Dict[str, Any]:
        """Get upload statistics for a user"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Total uploads
            cursor.execute("SELECT COUNT(*) FROM upload_history WHERE username = ?", (username,))
            total_uploads = cursor.fetchone()[0]
            
            # Successful uploads
            cursor.execute("SELECT COUNT(*) FROM upload_history WHERE username = ? AND status = 'completed'", (username,))
            successful_uploads = cursor.fetchone()[0]
            
            # Failed uploads
            cursor.execute("SELECT COUNT(*) FROM upload_history WHERE username = ? AND status = 'failed'", (username,))
            failed_uploads = cursor.fetchone()[0]
            
            # Recent uploads (last 7 days)
            cursor.execute("""
                SELECT COUNT(*) FROM upload_history 
                WHERE username = ? AND started_at > datetime('now', '-7 days')
            """, (username,))
            recent_uploads = cursor.fetchone()[0]
            
            return {
                'total_uploads': total_uploads,
                'successful_uploads': successful_uploads,
                'failed_uploads': failed_uploads,
                'recent_uploads': recent_uploads,
                'success_rate': (successful_uploads / total_uploads * 100) if total_uploads > 0 else 0
            }
    
    @staticmethod
    def _format_file_size(size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1
        
        return f"{size_bytes:.1f} {size_names[i]}"
