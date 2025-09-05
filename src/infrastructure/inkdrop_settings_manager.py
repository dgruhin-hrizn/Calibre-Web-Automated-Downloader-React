"""
Inkdrop Settings Manager - Leverages existing CWA database structure
Integrates with app.db settings table and creates inkdrop-config.db for additional settings
"""

import sqlite3
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from contextlib import contextmanager
from dataclasses import dataclass, field, asdict
import os

from .env import CWA_USER_DB_PATH, DATA_DIR

logger = logging.getLogger(__name__)

# Inkdrop-specific configuration database
INKDROP_CONFIG_DB = DATA_DIR / "inkdrop-config.db"

@dataclass
class SMTPSettings:
    """SMTP settings from app.db/settings table"""
    mail_server: str = ""
    mail_port: int = 587
    mail_use_ssl: bool = True
    mail_login: str = ""
    mail_password: str = ""
    mail_from: str = ""
    mail_size: int = 26214400  # 25MB default
    mail_server_type: int = 0  # 0=SMTP, 1=Gmail OAuth

@dataclass
class ConversionSettings:
    """Book conversion settings (stored in inkdrop-config.db)"""
    enabled: bool = False
    target_format: str = "epub"
    quality: str = "high"  # low, medium, high
    preserve_cover: bool = True
    preserve_metadata: bool = True
    timeout_seconds: int = 300
    supported_formats: List[str] = field(default_factory=lambda: [
        "azw", "azw3", "mobi", "pdf", "rtf", "txt", "html", "htm", 
        "fb2", "lit", "lrf", "pdb", "pml", "rb", "snb", "tcr", "zip"
    ])

@dataclass
class DownloadSettings:
    """Download management settings (stored in inkdrop-config.db)"""
    max_concurrent_downloads: int = 3
    max_concurrent_conversions: int = 2
    retry_attempts: int = 3
    cleanup_temp_files: bool = True
    timeout_seconds: int = 1800  # 30 minutes

@dataclass
class SystemSettings:
    """System-level settings (stored in inkdrop-config.db)"""
    calibre_library_path: str = "/calibre-library"
    ingest_directory: str = "/tmp/cwa-book-ingest"
    log_level: str = "INFO"
    enable_analytics: bool = False
    auto_cleanup_days: int = 30

@dataclass
class InkdropSettings:
    """Complete Inkdrop application settings"""
    smtp: SMTPSettings = field(default_factory=SMTPSettings)
    conversion: ConversionSettings = field(default_factory=ConversionSettings)
    downloads: DownloadSettings = field(default_factory=DownloadSettings)
    system: SystemSettings = field(default_factory=SystemSettings)

class InkdropSettingsManager:
    """
    Manages Inkdrop application settings using existing CWA database structure
    where possible, and creating additional databases only when needed.
    """
    
    def __init__(self):
        self.app_db_path = CWA_USER_DB_PATH
        self.inkdrop_config_db = INKDROP_CONFIG_DB
        self._init_databases()
        logger.info("Inkdrop Settings Manager initialized")
    
    def _init_databases(self):
        """Initialize database structures"""
        # Ensure inkdrop config database exists
        self.inkdrop_config_db.parent.mkdir(parents=True, exist_ok=True)
        self._init_inkdrop_config_db()
    
    def _init_inkdrop_config_db(self):
        """Initialize the inkdrop-config.db with required tables"""
        with self._get_inkdrop_connection() as conn:
            cursor = conn.cursor()
            
            # Conversion settings table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversion_settings (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    enabled BOOLEAN DEFAULT 0,
                    target_format TEXT DEFAULT 'epub',
                    quality TEXT DEFAULT 'high',
                    preserve_cover BOOLEAN DEFAULT 1,
                    preserve_metadata BOOLEAN DEFAULT 1,
                    timeout_seconds INTEGER DEFAULT 300,
                    supported_formats TEXT DEFAULT '["azw","azw3","mobi","pdf","rtf","txt","html","htm","fb2","lit","lrf","pdb","pml","rb","snb","tcr","zip"]',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Download settings table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS download_settings (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    max_concurrent_downloads INTEGER DEFAULT 3,
                    max_concurrent_conversions INTEGER DEFAULT 2,
                    retry_attempts INTEGER DEFAULT 3,
                    cleanup_temp_files BOOLEAN DEFAULT 1,
                    timeout_seconds INTEGER DEFAULT 1800,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # System settings table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    calibre_library_path TEXT DEFAULT '/calibre-library',
                    ingest_directory TEXT DEFAULT '/tmp/cwa-book-ingest',
                    log_level TEXT DEFAULT 'INFO',
                    enable_analytics BOOLEAN DEFAULT 0,
                    auto_cleanup_days INTEGER DEFAULT 30,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Insert default values if tables are empty
            cursor.execute("INSERT OR IGNORE INTO conversion_settings (id) VALUES (1)")
            cursor.execute("INSERT OR IGNORE INTO download_settings (id) VALUES (1)")
            cursor.execute("INSERT OR IGNORE INTO system_settings (id) VALUES (1)")
            
            conn.commit()
            logger.info("Inkdrop config database initialized")
    
    @contextmanager
    def _get_app_connection(self):
        """Get connection to app.db (read-only if possible)"""
        if not self.app_db_path.exists():
            raise FileNotFoundError(f"app.db not found at {self.app_db_path}")
        
        conn = sqlite3.connect(str(self.app_db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    @contextmanager
    def _get_inkdrop_connection(self):
        """Get connection to inkdrop-config.db"""
        conn = sqlite3.connect(str(self.inkdrop_config_db))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def get_smtp_settings(self) -> SMTPSettings:
        """Get SMTP settings from existing app.db/settings table"""
        try:
            with self._get_app_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT mail_server, mail_port, mail_use_ssl, mail_login, 
                           mail_password, mail_from, mail_size, mail_server_type
                    FROM settings LIMIT 1
                """)
                row = cursor.fetchone()
                
                if row:
                    return SMTPSettings(
                        mail_server=row['mail_server'] or "",
                        mail_port=row['mail_port'] or 587,
                        mail_use_ssl=bool(row['mail_use_ssl']),
                        mail_login=row['mail_login'] or "",
                        mail_password=row['mail_password'] or "",
                        mail_from=row['mail_from'] or "",
                        mail_size=row['mail_size'] or 26214400,
                        mail_server_type=row['mail_server_type'] or 0
                    )
                else:
                    logger.warning("No settings found in app.db, using defaults")
                    return SMTPSettings()
                    
        except Exception as e:
            logger.error(f"Error loading SMTP settings from app.db: {e}")
            return SMTPSettings()
    
    def update_smtp_settings(self, smtp_settings: SMTPSettings) -> bool:
        """Update SMTP settings in app.db/settings table"""
        try:
            with self._get_app_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE settings SET 
                        mail_server = ?, mail_port = ?, mail_use_ssl = ?,
                        mail_login = ?, mail_password = ?, mail_from = ?,
                        mail_size = ?, mail_server_type = ?
                    WHERE id = 1
                """, (
                    smtp_settings.mail_server,
                    smtp_settings.mail_port,
                    int(smtp_settings.mail_use_ssl),
                    smtp_settings.mail_login,
                    smtp_settings.mail_password,
                    smtp_settings.mail_from,
                    smtp_settings.mail_size,
                    smtp_settings.mail_server_type
                ))
                conn.commit()
                logger.info("SMTP settings updated in app.db")
                return True
        except Exception as e:
            logger.error(f"Error updating SMTP settings: {e}")
            return False
    
    def get_conversion_settings(self) -> ConversionSettings:
        """Get conversion settings from inkdrop-config.db"""
        try:
            with self._get_inkdrop_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM conversion_settings WHERE id = 1")
                row = cursor.fetchone()
                
                if row:
                    supported_formats = json.loads(row['supported_formats'])
                    return ConversionSettings(
                        enabled=bool(row['enabled']),
                        target_format=row['target_format'],
                        quality=row['quality'],
                        preserve_cover=bool(row['preserve_cover']),
                        preserve_metadata=bool(row['preserve_metadata']),
                        timeout_seconds=row['timeout_seconds'],
                        supported_formats=supported_formats
                    )
                else:
                    return ConversionSettings()
        except Exception as e:
            logger.error(f"Error loading conversion settings: {e}")
            return ConversionSettings()
    
    def update_conversion_settings(self, settings: ConversionSettings) -> bool:
        """Update conversion settings in inkdrop-config.db"""
        try:
            with self._get_inkdrop_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE conversion_settings SET
                        enabled = ?, target_format = ?, quality = ?,
                        preserve_cover = ?, preserve_metadata = ?,
                        timeout_seconds = ?, supported_formats = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                """, (
                    int(settings.enabled),
                    settings.target_format,
                    settings.quality,
                    int(settings.preserve_cover),
                    int(settings.preserve_metadata),
                    settings.timeout_seconds,
                    json.dumps(settings.supported_formats)
                ))
                conn.commit()
                logger.info("Conversion settings updated")
                return True
        except Exception as e:
            logger.error(f"Error updating conversion settings: {e}")
            return False
    
    def get_download_settings(self) -> DownloadSettings:
        """Get download settings from inkdrop-config.db"""
        try:
            with self._get_inkdrop_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM download_settings WHERE id = 1")
                row = cursor.fetchone()
                
                if row:
                    return DownloadSettings(
                        max_concurrent_downloads=row['max_concurrent_downloads'],
                        max_concurrent_conversions=row['max_concurrent_conversions'],
                        retry_attempts=row['retry_attempts'],
                        cleanup_temp_files=bool(row['cleanup_temp_files']),
                        timeout_seconds=row['timeout_seconds']
                    )
                else:
                    return DownloadSettings()
        except Exception as e:
            logger.error(f"Error loading download settings: {e}")
            return DownloadSettings()
    
    def update_download_settings(self, settings: DownloadSettings) -> bool:
        """Update download settings in inkdrop-config.db"""
        try:
            with self._get_inkdrop_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE download_settings SET
                        max_concurrent_downloads = ?, max_concurrent_conversions = ?,
                        retry_attempts = ?, cleanup_temp_files = ?,
                        timeout_seconds = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                """, (
                    settings.max_concurrent_downloads,
                    settings.max_concurrent_conversions,
                    settings.retry_attempts,
                    int(settings.cleanup_temp_files),
                    settings.timeout_seconds
                ))
                conn.commit()
                logger.info("Download settings updated")
                return True
        except Exception as e:
            logger.error(f"Error updating download settings: {e}")
            return False
    
    def get_system_settings(self) -> SystemSettings:
        """Get system settings from inkdrop-config.db"""
        try:
            with self._get_inkdrop_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM system_settings WHERE id = 1")
                row = cursor.fetchone()
                
                if row:
                    return SystemSettings(
                        calibre_library_path=row['calibre_library_path'],
                        ingest_directory=row['ingest_directory'],
                        log_level=row['log_level'],
                        enable_analytics=bool(row['enable_analytics']),
                        auto_cleanup_days=row['auto_cleanup_days']
                    )
                else:
                    return SystemSettings()
        except Exception as e:
            logger.error(f"Error loading system settings: {e}")
            return SystemSettings()
    
    def update_system_settings(self, settings: SystemSettings) -> bool:
        """Update system settings in inkdrop-config.db"""
        try:
            with self._get_inkdrop_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE system_settings SET
                        calibre_library_path = ?, ingest_directory = ?,
                        log_level = ?, enable_analytics = ?,
                        auto_cleanup_days = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                """, (
                    settings.calibre_library_path,
                    settings.ingest_directory,
                    settings.log_level,
                    int(settings.enable_analytics),
                    settings.auto_cleanup_days
                ))
                conn.commit()
                logger.info("System settings updated")
                return True
        except Exception as e:
            logger.error(f"Error updating system settings: {e}")
            return False
    
    def get_all_settings(self) -> InkdropSettings:
        """Get all application settings"""
        return InkdropSettings(
            smtp=self.get_smtp_settings(),
            conversion=self.get_conversion_settings(),
            downloads=self.get_download_settings(),
            system=self.get_system_settings()
        )
    
    def update_all_settings(self, settings: InkdropSettings) -> bool:
        """Update all application settings"""
        success = True
        success &= self.update_smtp_settings(settings.smtp)
        success &= self.update_conversion_settings(settings.conversion)
        success &= self.update_download_settings(settings.downloads)
        success &= self.update_system_settings(settings.system)
        return success

# Global instance
_settings_manager: Optional[InkdropSettingsManager] = None

def get_inkdrop_settings_manager() -> InkdropSettingsManager:
    """Get the global Inkdrop settings manager instance"""
    global _settings_manager
    if _settings_manager is None:
        _settings_manager = InkdropSettingsManager()
    return _settings_manager

def get_inkdrop_settings() -> InkdropSettings:
    """Convenience function to get all settings"""
    return get_inkdrop_settings_manager().get_all_settings()
