"""
Read Status Manager for Calibre-Web Integration
Manages user's book reading status using the same database structure as CWA
"""
import sqlite3
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class ReadStatusManager:
    """Manages user read/unread status for books using CWA's app.db structure"""
    
    # Status constants matching CWA (extended with want-to-read)
    STATUS_UNREAD = 0
    STATUS_FINISHED = 1
    STATUS_IN_PROGRESS = 2
    STATUS_WANT_TO_READ = 3
    
    def __init__(self, app_db_path: str):
        """Initialize with path to CWA's app.db"""
        self.db_path = Path(app_db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"CWA app.db not found: {app_db_path}")
        
        # Ensure tables exist
        self._initialize_tables()
        logger.info(f"ReadStatusManager initialized with database: {self.db_path}")
    
    @contextmanager
    def _get_connection(self):
        """Get database connection with proper error handling"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable column access by name
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def _initialize_tables(self):
        """Ensure required tables exist (matching CWA structure)"""
        with self._get_connection() as conn:
            # Create book_read_link table if it doesn't exist
            conn.execute('''
                CREATE TABLE IF NOT EXISTS book_read_link (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    book_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    read_status INTEGER NOT NULL DEFAULT 0,
                    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_time_started_reading TIMESTAMP,
                    times_started_reading INTEGER DEFAULT 0,
                    UNIQUE(book_id, user_id)
                )
            ''')
            
            # Create user table if it doesn't exist (simplified version)
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    email TEXT,
                    password TEXT,
                    role INTEGER DEFAULT 0,
                    locale TEXT DEFAULT 'en',
                    sidebar_view INTEGER DEFAULT 1,
                    default_language TEXT DEFAULT 'all'
                )
            ''')
            
            conn.commit()
    
    def get_user_id_by_username(self, username: str) -> Optional[int]:
        """Get user ID by username"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT id FROM user WHERE name = ?", 
                (username,)
            )
            row = cursor.fetchone()
            return row['id'] if row else None
    
    def get_or_create_user(self, username: str, email: str = None) -> int:
        """Get existing user ID or create new user"""
        user_id = self.get_user_id_by_username(username)
        if user_id:
            return user_id
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                "INSERT INTO user (name, email) VALUES (?, ?)",
                (username, email or f"{username}@local")
            )
            conn.commit()
            return cursor.lastrowid
    
    def get_book_read_status(self, book_id: int, user_id: int) -> Dict[str, Any]:
        """Get read status for a specific book and user"""
        with self._get_connection() as conn:
            cursor = conn.execute('''
                SELECT read_status, last_modified, last_time_started_reading, times_started_reading
                FROM book_read_link 
                WHERE book_id = ? AND user_id = ?
            ''', (book_id, user_id))
            
            row = cursor.fetchone()
            if row:
                return {
                    'book_id': book_id,
                    'read_status': row['read_status'],
                    'is_read': row['read_status'] == self.STATUS_FINISHED,
                    'is_in_progress': row['read_status'] == self.STATUS_IN_PROGRESS,
                    'is_want_to_read': row['read_status'] == self.STATUS_WANT_TO_READ,
                    'last_modified': row['last_modified'],
                    'last_time_started_reading': row['last_time_started_reading'],
                    'times_started_reading': row['times_started_reading'] or 0
                }
            else:
                # No record means unread
                return {
                    'book_id': book_id,
                    'read_status': self.STATUS_UNREAD,
                    'is_read': False,
                    'is_in_progress': False,
                    'is_want_to_read': False,
                    'last_modified': None,
                    'last_time_started_reading': None,
                    'times_started_reading': 0
                }
    
    def get_multiple_books_read_status(self, book_ids: List[int], user_id: int) -> Dict[int, Dict[str, Any]]:
        """Get read status for multiple books efficiently"""
        if not book_ids:
            return {}
        
        with self._get_connection() as conn:
            # Create placeholders for the IN clause
            placeholders = ','.join('?' * len(book_ids))
            cursor = conn.execute(f'''
                SELECT book_id, read_status, last_modified, last_time_started_reading, times_started_reading
                FROM book_read_link 
                WHERE book_id IN ({placeholders}) AND user_id = ?
            ''', book_ids + [user_id])
            
            # Build result dict
            result = {}
            for row in cursor.fetchall():
                book_id = row['book_id']
                result[book_id] = {
                    'book_id': book_id,
                    'read_status': row['read_status'],
                    'is_read': row['read_status'] == self.STATUS_FINISHED,
                    'is_in_progress': row['read_status'] == self.STATUS_IN_PROGRESS,
                    'is_want_to_read': row['read_status'] == self.STATUS_WANT_TO_READ,
                    'last_modified': row['last_modified'],
                    'last_time_started_reading': row['last_time_started_reading'],
                    'times_started_reading': row['times_started_reading'] or 0
                }
            
            # Fill in unread status for books not in database
            for book_id in book_ids:
                if book_id not in result:
                    result[book_id] = {
                        'book_id': book_id,
                        'read_status': self.STATUS_UNREAD,
                        'is_read': False,
                        'is_in_progress': False,
                        'is_want_to_read': False,
                        'last_modified': None,
                        'last_time_started_reading': None,
                        'times_started_reading': 0
                    }
            
            return result
    
    def set_book_read_status(self, book_id: int, user_id: int, read_status: int) -> bool:
        """Set read status for a book"""
        if read_status not in [self.STATUS_UNREAD, self.STATUS_FINISHED, self.STATUS_IN_PROGRESS, self.STATUS_WANT_TO_READ]:
            raise ValueError(f"Invalid read status: {read_status}")
        
        now = datetime.now(timezone.utc).isoformat()
        
        with self._get_connection() as conn:
            # Check if record exists
            cursor = conn.execute(
                "SELECT id, times_started_reading FROM book_read_link WHERE book_id = ? AND user_id = ?",
                (book_id, user_id)
            )
            row = cursor.fetchone()
            
            if row:
                # Update existing record
                times_started = row['times_started_reading'] or 0
                last_started = None
                
                # If changing to in_progress, update reading tracking
                if read_status == self.STATUS_IN_PROGRESS:
                    times_started += 1
                    last_started = now
                
                conn.execute('''
                    UPDATE book_read_link 
                    SET read_status = ?, 
                        last_modified = ?,
                        last_time_started_reading = COALESCE(?, last_time_started_reading),
                        times_started_reading = ?
                    WHERE book_id = ? AND user_id = ?
                ''', (read_status, now, last_started, times_started, book_id, user_id))
            else:
                # Create new record
                times_started = 1 if read_status == self.STATUS_IN_PROGRESS else 0
                last_started = now if read_status == self.STATUS_IN_PROGRESS else None
                
                conn.execute('''
                    INSERT INTO book_read_link 
                    (book_id, user_id, read_status, last_modified, last_time_started_reading, times_started_reading)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (book_id, user_id, read_status, now, last_started, times_started))
            
            conn.commit()
            return True
    
    def toggle_book_read_status(self, book_id: int, user_id: int) -> Dict[str, Any]:
        """Toggle between read/unread (matching CWA behavior)"""
        current_status = self.get_book_read_status(book_id, user_id)
        
        if current_status['read_status'] == self.STATUS_FINISHED:
            new_status = self.STATUS_UNREAD
        else:
            new_status = self.STATUS_FINISHED
        
        self.set_book_read_status(book_id, user_id, new_status)
        return self.get_book_read_status(book_id, user_id)
    
    def mark_as_read(self, book_id: int, user_id: int) -> bool:
        """Mark book as read"""
        return self.set_book_read_status(book_id, user_id, self.STATUS_FINISHED)
    
    def mark_as_unread(self, book_id: int, user_id: int) -> bool:
        """Mark book as unread"""
        return self.set_book_read_status(book_id, user_id, self.STATUS_UNREAD)
    
    def mark_as_in_progress(self, book_id: int, user_id: int) -> bool:
        """Mark book as currently reading"""
        return self.set_book_read_status(book_id, user_id, self.STATUS_IN_PROGRESS)
    
    def mark_as_want_to_read(self, book_id: int, user_id: int) -> bool:
        """Mark book as want to read"""
        return self.set_book_read_status(book_id, user_id, self.STATUS_WANT_TO_READ)
    
    def get_user_reading_stats(self, user_id: int) -> Dict[str, int]:
        """Get reading statistics for a user"""
        with self._get_connection() as conn:
            cursor = conn.execute('''
                SELECT 
                    read_status,
                    COUNT(*) as count
                FROM book_read_link 
                WHERE user_id = ?
                GROUP BY read_status
            ''', (user_id,))
            
            stats = {
                'total_books_tracked': 0,
                'books_read': 0,
                'books_in_progress': 0,
                'books_unread': 0
            }
            
            for row in cursor.fetchall():
                status = row['read_status']
                count = row['count']
                stats['total_books_tracked'] += count
                
                if status == self.STATUS_FINISHED:
                    stats['books_read'] = count
                elif status == self.STATUS_IN_PROGRESS:
                    stats['books_in_progress'] = count
                elif status == self.STATUS_UNREAD:
                    stats['books_unread'] = count
            
            return stats
    
    def get_books_by_read_status(self, user_id: int, read_status: int, limit: Optional[int] = 50, offset: int = 0) -> List[int]:
        """Get list of book IDs by read status with pagination support"""
        with self._get_connection() as conn:
            if limit is None:
                # No limit - get all books
                cursor = conn.execute('''
                    SELECT book_id 
                    FROM book_read_link 
                    WHERE user_id = ? AND read_status = ?
                    ORDER BY last_modified DESC
                    OFFSET ?
                ''', (user_id, read_status, offset))
            else:
                # With limit and offset
                cursor = conn.execute('''
                    SELECT book_id 
                    FROM book_read_link 
                    WHERE user_id = ? AND read_status = ?
                    ORDER BY last_modified DESC
                    LIMIT ? OFFSET ?
                ''', (user_id, read_status, limit, offset))
            
            return [row['book_id'] for row in cursor.fetchall()]

    def get_books_count_by_status(self, user_id: int, read_status: int) -> int:
        """Get count of books by read status"""
        with self._get_connection() as conn:
            cursor = conn.execute('''
                SELECT COUNT(*) as count
                FROM book_read_link 
                WHERE user_id = ? AND read_status = ?
            ''', (user_id, read_status))
            
            result = cursor.fetchone()
            return result['count'] if result else 0

    def get_all_user_books_paginated(self, user_id: int, limit: int = 50, offset: int = 0) -> tuple[List[int], int]:
        """Get all user books across all statuses with pagination"""
        with self._get_connection() as conn:
            # Get total count first
            count_cursor = conn.execute('''
                SELECT COUNT(*) as total
                FROM book_read_link 
                WHERE user_id = ? AND read_status IN (?, ?, ?)
            ''', (user_id, self.STATUS_FINISHED, self.STATUS_IN_PROGRESS, self.STATUS_WANT_TO_READ))
            
            total_count = count_cursor.fetchone()['total']
            
            # Get paginated book IDs
            cursor = conn.execute('''
                SELECT book_id 
                FROM book_read_link 
                WHERE user_id = ? AND read_status IN (?, ?, ?)
                ORDER BY last_modified DESC
                LIMIT ? OFFSET ?
            ''', (user_id, self.STATUS_FINISHED, self.STATUS_IN_PROGRESS, self.STATUS_WANT_TO_READ, limit, offset))
            
            book_ids = [row['book_id'] for row in cursor.fetchall()]
            
            return book_ids, total_count


# Global instance
_read_status_manager = None

def get_read_status_manager(app_db_path: str = None) -> ReadStatusManager:
    """Get or create the global read status manager instance"""
    global _read_status_manager
    
    if _read_status_manager is None and app_db_path:
        _read_status_manager = ReadStatusManager(app_db_path)
    
    return _read_status_manager
