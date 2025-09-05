# Legacy compatibility layer - redirects to new database-based settings
# This maintains backward compatibility while using the new Inkdrop settings system

import logging
from dataclasses import dataclass, field
from typing import Optional

from .inkdrop_settings_manager import get_inkdrop_settings_manager, ConversionSettings as InkdropConversionSettings, DownloadSettings as InkdropDownloadSettings

logger = logging.getLogger(__name__)

# Legacy dataclasses for backward compatibility
@dataclass
class ConversionSettings:
    enabled: bool = False
    target_format: str = "epub"
    quality: str = "high"
    preserve_cover: bool = True
    preserve_metadata: bool = True
    timeout_seconds: int = 300
    supported_formats: list[str] = field(default_factory=lambda: ["azw", "azw3", "mobi", "pdf", "rtf", "txt", "html", "htm", "fb2", "lit", "lrf", "pdb", "pml", "rb", "snb", "tcr", "zip"])

@dataclass
class DownloadSettings:
    max_concurrent_downloads: int = 3
    max_concurrent_conversions: int = 2
    retry_attempts: int = 3
    cleanup_temp_files: bool = True

@dataclass
class AppSettings:
    conversion: ConversionSettings = field(default_factory=ConversionSettings)
    downloads: DownloadSettings = field(default_factory=DownloadSettings)

def _convert_from_inkdrop(inkdrop_settings) -> AppSettings:
    """Convert Inkdrop settings to legacy AppSettings format"""
    conversion = ConversionSettings(
        enabled=inkdrop_settings.conversion.enabled,
        target_format=inkdrop_settings.conversion.target_format,
        quality=inkdrop_settings.conversion.quality,
        preserve_cover=inkdrop_settings.conversion.preserve_cover,
        preserve_metadata=inkdrop_settings.conversion.preserve_metadata,
        timeout_seconds=inkdrop_settings.conversion.timeout_seconds,
        supported_formats=inkdrop_settings.conversion.supported_formats
    )
    
    downloads = DownloadSettings(
        max_concurrent_downloads=inkdrop_settings.downloads.max_concurrent_downloads,
        max_concurrent_conversions=inkdrop_settings.downloads.max_concurrent_conversions,
        retry_attempts=inkdrop_settings.downloads.retry_attempts,
        cleanup_temp_files=inkdrop_settings.downloads.cleanup_temp_files
    )
    
    return AppSettings(conversion=conversion, downloads=downloads)

def _convert_to_inkdrop(app_settings: AppSettings):
    """Convert legacy AppSettings to Inkdrop format"""
    inkdrop_conversion = InkdropConversionSettings(
        enabled=app_settings.conversion.enabled,
        target_format=app_settings.conversion.target_format,
        quality=app_settings.conversion.quality,
        preserve_cover=app_settings.conversion.preserve_cover,
        preserve_metadata=app_settings.conversion.preserve_metadata,
        timeout_seconds=app_settings.conversion.timeout_seconds,
        supported_formats=app_settings.conversion.supported_formats
    )
    
    inkdrop_downloads = InkdropDownloadSettings(
        max_concurrent_downloads=app_settings.downloads.max_concurrent_downloads,
        max_concurrent_conversions=app_settings.downloads.max_concurrent_conversions,
        retry_attempts=app_settings.downloads.retry_attempts,
        cleanup_temp_files=app_settings.downloads.cleanup_temp_files
    )
    
    return inkdrop_conversion, inkdrop_downloads

def get_app_settings() -> AppSettings:
    """Get app settings using new database-based system"""
    try:
        settings_manager = get_inkdrop_settings_manager()
        inkdrop_settings = settings_manager.get_all_settings()
        return _convert_from_inkdrop(inkdrop_settings)
    except Exception as e:
        logger.error(f"Error loading settings from database: {e}")
        return AppSettings()  # Return defaults

def update_app_settings(new_settings_data: dict) -> bool:
    """Update app settings using new database-based system"""
    try:
        settings_manager = get_inkdrop_settings_manager()
        current_settings = get_app_settings()
        
        # Update conversion settings
        if 'conversion' in new_settings_data:
            for key, value in new_settings_data['conversion'].items():
                if hasattr(current_settings.conversion, key):
                    setattr(current_settings.conversion, key, value)
        
        # Update download settings
        if 'downloads' in new_settings_data:
            for key, value in new_settings_data['downloads'].items():
                if hasattr(current_settings.downloads, key):
                    setattr(current_settings.downloads, key, value)
        
        # Convert and save to database
        inkdrop_conversion, inkdrop_downloads = _convert_to_inkdrop(current_settings)
        
        success = True
        success &= settings_manager.update_conversion_settings(inkdrop_conversion)
        success &= settings_manager.update_download_settings(inkdrop_downloads)
        
        logger.info("App settings updated successfully using database")
        return success
        
    except Exception as e:
        logger.error(f"Error updating settings in database: {e}")
        return False

# Legacy functions for backward compatibility
def load_settings() -> AppSettings:
    """Legacy function - redirects to get_app_settings()"""
    return get_app_settings()

def save_settings(settings: AppSettings) -> bool:
    """Legacy function - converts to new format and saves"""
    try:
        settings_manager = get_inkdrop_settings_manager()
        inkdrop_conversion, inkdrop_downloads = _convert_to_inkdrop(settings)
        
        success = True
        success &= settings_manager.update_conversion_settings(inkdrop_conversion)
        success &= settings_manager.update_download_settings(inkdrop_downloads)
        
        return success
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        return False