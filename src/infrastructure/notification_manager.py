"""
Notification Manager - Real-time notification system for download events
Provides immediate notifications without polling delays
"""

import logging
import threading
from typing import Dict, List, Callable, Optional
from datetime import datetime
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class Notification:
    """Notification data structure"""
    id: str
    type: str  # 'download_completed', 'download_failed', etc.
    title: str
    message: str
    timestamp: float
    book_id: Optional[str] = None
    book_title: Optional[str] = None
    book_author: Optional[str] = None
    cover_url: Optional[str] = None
    auto_hide: bool = True
    duration: int = 5000  # milliseconds

class NotificationManager:
    """Manages real-time notifications for download events"""
    
    _instance: Optional['NotificationManager'] = None
    _lock = threading.Lock()
    
    def __init__(self):
        self._notifications: List[Notification] = []
        self._subscribers: List[Callable[[Notification], None]] = []
        self._lock = threading.Lock()
        
    @classmethod
    def get_instance(cls) -> 'NotificationManager':
        """Get singleton instance of NotificationManager"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    def notify_download_completed(self, book_id: str, title: str, author: str, cover_url: str = None) -> None:
        """Notify that a download has completed"""
        notification = Notification(
            id=f"download_completed_{book_id}_{int(datetime.now().timestamp())}",
            type="download_completed",
            title="Download Completed",
            message=f'"{title}" is ready to read',
            timestamp=datetime.now().timestamp() * 1000,  # JavaScript timestamp
            book_id=book_id,
            book_title=title,
            book_author=author,
            cover_url=cover_url,
            auto_hide=True,
            duration=5000
        )
        
        self._add_notification(notification)
        logger.info(f"Download completion notification sent: {title}")
    
    def notify_download_failed(self, book_id: str, title: str, author: str, error: str = None, cover_url: str = None) -> None:
        """Notify that a download has failed"""
        notification = Notification(
            id=f"download_failed_{book_id}_{int(datetime.now().timestamp())}",
            type="download_failed", 
            title="Download Failed",
            message=f'"{title}" failed to download' + (f': {error}' if error else ''),
            timestamp=datetime.now().timestamp() * 1000,  # JavaScript timestamp
            book_id=book_id,
            book_title=title,
            book_author=author,
            cover_url=cover_url,
            auto_hide=True,
            duration=7000  # Longer for errors
        )
        
        self._add_notification(notification)
        logger.info(f"Download failure notification sent: {title}")
    
    def _add_notification(self, notification: Notification) -> None:
        """Add notification and notify subscribers"""
        with self._lock:
            # Add to recent notifications (keep last 20)
            self._notifications.append(notification)
            if len(self._notifications) > 20:
                self._notifications.pop(0)
            
            # Notify all subscribers
            for subscriber in self._subscribers:
                try:
                    subscriber(notification)
                except Exception as e:
                    logger.error(f"Error notifying subscriber: {e}")
    
    def subscribe(self, callback: Callable[[Notification], None]) -> None:
        """Subscribe to notifications"""
        with self._lock:
            self._subscribers.append(callback)
    
    def unsubscribe(self, callback: Callable[[Notification], None]) -> None:
        """Unsubscribe from notifications"""
        with self._lock:
            if callback in self._subscribers:
                self._subscribers.remove(callback)
    
    def get_recent_notifications(self, limit: int = 10) -> List[Dict]:
        """Get recent notifications as dict for API response"""
        with self._lock:
            recent = self._notifications[-limit:] if limit > 0 else self._notifications[:]
            return [asdict(notification) for notification in recent]
    
    def clear_notifications(self) -> None:
        """Clear all notifications"""
        with self._lock:
            self._notifications.clear()
