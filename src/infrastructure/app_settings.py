"""
Application Settings Management

Handles global application settings stored in app_settings.json.
These are admin-only settings that affect the entire application.
"""

import json
import os
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ConversionSettings:
    """Settings for book format conversion"""
    enabled: bool = False
    target_format: str = "epub"
    supported_formats: list = None
    quality: str = "high"  # low, medium, high
    preserve_cover: bool = True
    preserve_metadata: bool = True
    timeout_seconds: int = 300  # 5 minutes
    
    def __post_init__(self):
        if self.supported_formats is None:
            self.supported_formats = ["pdf", "mobi", "azw3", "fb2", "docx", "txt", "rtf"]


@dataclass
class DownloadSettings:
    """Settings for download behavior"""
    max_concurrent_downloads: int = 3
    max_concurrent_conversions: int = 2
    retry_attempts: int = 3
    timeout_seconds: int = 300
    cleanup_temp_files: bool = True


@dataclass
class AppSettings:
    """Global application settings"""
    conversion: ConversionSettings = None
    downloads: DownloadSettings = None
    calibre_library_path: str = "/calibre-library"
    
    def __post_init__(self):
        if self.conversion is None:
            self.conversion = ConversionSettings()
        if self.downloads is None:
            self.downloads = DownloadSettings()


class AppSettingsManager:
    """Manages loading, saving, and validation of application settings"""
    
    def __init__(self, settings_file: str = "app_settings.json"):
        self.settings_file = Path(settings_file)
        self._settings: Optional[AppSettings] = None
        
    def load_settings(self) -> AppSettings:
        """Load settings from file, create defaults if file doesn't exist"""
        try:
            if self.settings_file.exists():
                logger.info(f"Loading app settings from {self.settings_file}")
                with open(self.settings_file, 'r') as f:
                    data = json.load(f)
                
                # Convert nested dicts back to dataclasses
                if 'conversion' in data and isinstance(data['conversion'], dict):
                    data['conversion'] = ConversionSettings(**data['conversion'])
                if 'downloads' in data and isinstance(data['downloads'], dict):
                    data['downloads'] = DownloadSettings(**data['downloads'])
                    
                self._settings = AppSettings(**data)
                logger.info("App settings loaded successfully")
            else:
                logger.info("No app settings file found, creating defaults")
                self._settings = AppSettings()
                self.save_settings()  # Save defaults
                
        except Exception as e:
            logger.error(f"Error loading app settings: {e}")
            logger.info("Using default settings")
            self._settings = AppSettings()
            
        return self._settings
    
    def save_settings(self, settings: Optional[AppSettings] = None) -> bool:
        """Save settings to file"""
        try:
            if settings:
                self._settings = settings
            elif not self._settings:
                logger.error("No settings to save")
                return False
                
            # Convert to dict, handling nested dataclasses
            data = asdict(self._settings)
            
            # Ensure parent directory exists
            self.settings_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Write with pretty formatting
            with open(self.settings_file, 'w') as f:
                json.dump(data, f, indent=2)
                
            logger.info(f"App settings saved to {self.settings_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving app settings: {e}")
            return False
    
    def get_settings(self) -> AppSettings:
        """Get current settings, loading from file if not already loaded"""
        if self._settings is None:
            return self.load_settings()
        return self._settings
    
    def update_settings(self, updates: Dict[str, Any]) -> bool:
        """Update settings with partial data"""
        try:
            current = self.get_settings()
            
            # Deep merge the updates
            updated_data = self._deep_merge(asdict(current), updates)
            
            # Validate the updated settings
            if not self._validate_settings(updated_data):
                return False
                
            # Convert back to dataclasses
            if 'conversion' in updated_data and isinstance(updated_data['conversion'], dict):
                updated_data['conversion'] = ConversionSettings(**updated_data['conversion'])
            if 'downloads' in updated_data and isinstance(updated_data['downloads'], dict):
                updated_data['downloads'] = DownloadSettings(**updated_data['downloads'])
                
            new_settings = AppSettings(**updated_data)
            return self.save_settings(new_settings)
            
        except Exception as e:
            logger.error(f"Error updating app settings: {e}")
            return False
    
    def _deep_merge(self, base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge two dictionaries"""
        result = base.copy()
        
        for key, value in updates.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
                
        return result
    
    def _validate_settings(self, data: Dict[str, Any]) -> bool:
        """Validate settings data"""
        try:
            # Validate conversion settings
            if 'conversion' in data:
                conv = data['conversion']
                if 'target_format' in conv and conv['target_format'] not in ['epub', 'pdf', 'mobi', 'azw3']:
                    logger.error(f"Invalid target format: {conv['target_format']}")
                    return False
                    
                if 'quality' in conv and conv['quality'] not in ['low', 'medium', 'high']:
                    logger.error(f"Invalid quality setting: {conv['quality']}")
                    return False
                    
                if 'timeout_seconds' in conv and (conv['timeout_seconds'] < 30 or conv['timeout_seconds'] > 3600):
                    logger.error(f"Invalid timeout: {conv['timeout_seconds']} (must be 30-3600 seconds)")
                    return False
            
            # Validate download settings
            if 'downloads' in data:
                dl = data['downloads']
                if 'max_concurrent_downloads' in dl and (dl['max_concurrent_downloads'] < 1 or dl['max_concurrent_downloads'] > 10):
                    logger.error(f"Invalid max concurrent downloads: {dl['max_concurrent_downloads']} (must be 1-10)")
                    return False
                    
                if 'max_concurrent_conversions' in dl and (dl['max_concurrent_conversions'] < 1 or dl['max_concurrent_conversions'] > 5):
                    logger.error(f"Invalid max concurrent conversions: {dl['max_concurrent_conversions']} (must be 1-5)")
                    return False
            
            # Validate library path
            if 'calibre_library_path' in data:
                path = data['calibre_library_path']
                if not isinstance(path, str) or not path:
                    logger.error("Invalid calibre_library_path")
                    return False
                    
            return True
            
        except Exception as e:
            logger.error(f"Settings validation error: {e}")
            return False


# Global instance
_settings_manager = AppSettingsManager()

def get_app_settings() -> AppSettings:
    """Get global app settings"""
    return _settings_manager.get_settings()

def save_app_settings(settings: AppSettings) -> bool:
    """Save global app settings"""
    return _settings_manager.save_settings(settings)

def update_app_settings(updates: Dict[str, Any]) -> bool:
    """Update global app settings with partial data"""
    return _settings_manager.update_settings(updates)
