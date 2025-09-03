"""
Direct CWA SQLite Database Management
Manages CWA users and permissions directly through the app.db database
"""

import sqlite3
import os
from pathlib import Path
from typing import List, Dict, Optional, Any
from werkzeug.security import generate_password_hash, check_password_hash
from ..infrastructure.env import CWA_DB_PATH
from ..infrastructure.logger import setup_logger

logger = setup_logger(__name__)

# CWA Role bit flags (from Calibre-Web source)
ROLE_ADMIN = 1
ROLE_DOWNLOAD = 2
ROLE_UPLOAD = 4
ROLE_EDIT = 8
ROLE_PASSWD = 16
ROLE_ANONYMOUS = 32
ROLE_EDIT_SHELFS = 64
ROLE_DELETE_BOOKS = 128
ROLE_VIEWER = 256

ROLE_NAMES = {
    ROLE_ADMIN: 'Admin',
    ROLE_DOWNLOAD: 'Download',
    ROLE_UPLOAD: 'Upload',
    ROLE_EDIT: 'Edit',
    ROLE_PASSWD: 'Change Password',
    ROLE_EDIT_SHELFS: 'Edit Shelfs',
    ROLE_DELETE_BOOKS: 'Delete Books',
    ROLE_VIEWER: 'Viewer'
}

class CWADBManager:
    """Direct CWA SQLite database manager for user administration"""
    
    def __init__(self):
        """Initialize the CWA database manager"""
        self.db_path = self._find_app_db()
        if not self.db_path:
            raise FileNotFoundError("CWA app.db not found")
        
        logger.info(f"CWA DB Manager initialized with database: {self.db_path}")
    
    def _find_app_db(self) -> Optional[Path]:
        """Find the CWA app.db file"""
        try:
            # First check if CWA_DB_PATH points to app.db directly
            if CWA_DB_PATH and CWA_DB_PATH.name == 'app.db' and CWA_DB_PATH.exists():
                return CWA_DB_PATH
            
            # Look for app.db in the same directory as CWA_DB_PATH
            if CWA_DB_PATH and CWA_DB_PATH.exists():
                app_db_path = CWA_DB_PATH.parent / "app.db"
                if app_db_path.exists():
                    return app_db_path
            
            # Check common locations
            common_paths = [
                Path("/config/app.db"),
                Path("./cwa-data/config/app.db"),
                Path("./app.db")
            ]
            
            for path in common_paths:
                if path.exists():
                    return path
            
            logger.error("Could not find CWA app.db")
            return None
            
        except Exception as e:
            logger.error(f"Error finding app.db: {e}")
            return None
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row  # Enable dict-like access to rows
        return conn
    
    def _role_to_permissions(self, role: int) -> Dict[str, bool]:
        """Convert role bitmask to permissions dictionary"""
        return {
            'admin': bool(role & ROLE_ADMIN),
            'download': bool(role & ROLE_DOWNLOAD),
            'upload': bool(role & ROLE_UPLOAD),
            'edit': bool(role & ROLE_EDIT),
            'passwd': bool(role & ROLE_PASSWD),
            'edit_shelfs': bool(role & ROLE_EDIT_SHELFS),
            'delete_books': bool(role & ROLE_DELETE_BOOKS),
            'viewer': bool(role & ROLE_VIEWER)
        }
    
    def _permissions_to_role(self, permissions: Dict[str, bool]) -> int:
        """Convert permissions dictionary to role bitmask"""
        role = 0
        if permissions.get('admin', False):
            role |= ROLE_ADMIN
        if permissions.get('download', False):
            role |= ROLE_DOWNLOAD
        if permissions.get('upload', False):
            role |= ROLE_UPLOAD
        if permissions.get('edit', False):
            role |= ROLE_EDIT
        if permissions.get('passwd', False):
            role |= ROLE_PASSWD
        if permissions.get('edit_shelfs', False):
            role |= ROLE_EDIT_SHELFS
        if permissions.get('delete_books', False):
            role |= ROLE_DELETE_BOOKS
        if permissions.get('viewer', False):
            role |= ROLE_VIEWER
        return role
    
    def _role_to_permission_names(self, role: int) -> List[str]:
        """Convert role bitmask to list of permission names"""
        permissions = []
        for bit, name in ROLE_NAMES.items():
            if role & bit:
                permissions.append(name)
        return permissions
    
    def get_all_users(self) -> List[Dict[str, Any]]:
        """Get all users from the database (excludes system Guest user)"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, name, email, kindle_mail, locale, default_language, role
                    FROM user 
                    WHERE name != 'Guest'
                    ORDER BY LOWER(name) ASC
                """)
                
                users = []
                for row in cursor.fetchall():
                    users.append({
                        'id': str(row['id']),
                        'username': row['name'],
                        'email': row['email'] or '',
                        'kindle_email': row['kindle_mail'] or '',
                        'locale': row['locale'] or 'en',
                        'default_language': row['default_language'] or 'en',
                        'role': row['role'],
                        'permissions': self._role_to_permission_names(row['role'])
                    })
                
                logger.info(f"Retrieved {len(users)} users from database")
                return users
                
        except Exception as e:
            logger.error(f"Error getting users: {e}")
            return []
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific user by ID (excludes system Guest user)"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, name, email, kindle_mail, locale, default_language, role
                    FROM user 
                    WHERE id = ? AND name != 'Guest'
                """, (user_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                return {
                    'id': str(row['id']),
                    'username': row['name'],
                    'email': row['email'] or '',
                    'kindle_email': row['kindle_mail'] or '',
                    'locale': row['locale'] or 'en',
                    'default_language': row['default_language'] or 'en',
                    'permissions': self._role_to_permissions(row['role'])
                }
                
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {e}")
            return None
    
    def create_user(self, username: str, email: str, password: str, 
                   kindle_email: str = '', locale: str = 'en', 
                   default_language: str = 'en', 
                   permissions: Dict[str, bool] = None) -> bool:
        """Create a new user (prevents creating system Guest user)"""
        try:
            # Prevent creating a user named "Guest" (system reserved)
            if username.lower() == 'guest':
                logger.warning(f"Attempted to create system reserved username: {username}")
                return False
                
            if permissions is None:
                permissions = {'download': True, 'passwd': True}  # Default permissions
            
            role = self._permissions_to_role(permissions)
            password_hash = generate_password_hash(password)
            
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO user (name, email, password, kindle_mail, locale, default_language, role)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (username, email, password_hash, kindle_email, locale, default_language, role))
                
                conn.commit()
                logger.info(f"Created user: {username}")
                return True
                
        except Exception as e:
            logger.error(f"Error creating user {username}: {e}")
            return False
    
    def update_user(self, user_id: int, username: str = None, email: str = None,
                   kindle_email: str = None, locale: str = None,
                   default_language: str = None, 
                   permissions: Dict[str, bool] = None) -> bool:
        """Update an existing user (prevents updating system Guest user)"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if this is the Guest user - prevent updates
                cursor.execute("SELECT name FROM user WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if user_row and user_row['name'] == 'Guest':
                    logger.warning(f"Attempted to update system Guest user (ID: {user_id})")
                    return False
                
                # Build dynamic update query
                updates = []
                params = []
                
                if username is not None:
                    updates.append("name = ?")
                    params.append(username)
                
                if email is not None:
                    updates.append("email = ?")
                    params.append(email)
                
                if kindle_email is not None:
                    updates.append("kindle_mail = ?")
                    params.append(kindle_email)
                
                if locale is not None:
                    updates.append("locale = ?")
                    params.append(locale)
                
                if default_language is not None:
                    updates.append("default_language = ?")
                    params.append(default_language)
                
                if permissions is not None:
                    role = self._permissions_to_role(permissions)
                    updates.append("role = ?")
                    params.append(role)
                
                if not updates:
                    return True  # Nothing to update
                
                params.append(user_id)
                
                cursor.execute(f"""
                    UPDATE user 
                    SET {', '.join(updates)}
                    WHERE id = ?
                """, params)
                
                conn.commit()
                logger.info(f"Updated user ID {user_id}")
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {e}")
            return False
    
    def delete_user(self, user_id: int) -> bool:
        """Delete a user (prevents deleting system Guest user)"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if this is the Guest user - prevent deletion
                cursor.execute("SELECT name FROM user WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if user_row and user_row['name'] == 'Guest':
                    logger.warning(f"Attempted to delete system Guest user (ID: {user_id})")
                    return False
                
                cursor.execute("DELETE FROM user WHERE id = ?", (user_id,))
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"Deleted user ID {user_id}")
                    return True
                else:
                    logger.warning(f"User ID {user_id} not found for deletion")
                    return False
                
        except Exception as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            return False
    
    def user_exists(self, username: str) -> bool:
        """Check if a user exists"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 FROM user WHERE name = ?", (username,))
                return cursor.fetchone() is not None
                
        except Exception as e:
            logger.error(f"Error checking if user exists {username}: {e}")
            return False
    
    def get_user_permissions(self, username: str) -> Dict[str, bool]:
        """Get user permissions by username"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT role FROM user WHERE name = ?", (username,))
                row = cursor.fetchone()
                
                if row:
                    return self._role_to_permissions(row['role'])
                else:
                    return {}
                    
        except Exception as e:
            logger.error(f"Error getting permissions for {username}: {e}")
            return {}


# Global instance
_cwa_db_manager = None

def get_cwa_db_manager() -> Optional[CWADBManager]:
    """Get or create the CWA database manager instance"""
    global _cwa_db_manager
    
    if _cwa_db_manager is None:
        try:
            _cwa_db_manager = CWADBManager()
        except Exception as e:
            logger.error(f"Failed to initialize CWA DB Manager: {e}")
            return None
    
    return _cwa_db_manager
