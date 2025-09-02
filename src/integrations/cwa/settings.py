# CWA Settings Management
# Handles saving and loading CWA connection settings to/from JSON file

import json
import logging
from pathlib import Path
from typing import Dict, Optional
import os

logger = logging.getLogger(__name__)

class CWASettings:
    """Manages CWA connection settings"""
    
    def __init__(self, config_path: str = None):
        self.config_path = Path(config_path or os.getenv('CWA_SETTINGS_PATH', './cwa_settings.json'))
        self.default_settings = {
            'base_url': 'http://localhost:8083',
            'username': '',
            'password': '',
            'enabled': False,
            'timeout': 30,
            'verify_ssl': True
        }
    
    def load_settings(self) -> Dict:
        """Load CWA settings from JSON file"""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    settings = json.load(f)
                    
                # Merge with defaults to ensure all keys exist
                merged_settings = self.default_settings.copy()
                merged_settings.update(settings)
                
                logger.info("CWA settings loaded successfully")
                return merged_settings
            else:
                logger.info("No CWA settings file found, using defaults")
                return self.default_settings.copy()
                
        except Exception as e:
            logger.error(f"Error loading CWA settings: {e}")
            return self.default_settings.copy()
    
    def save_settings(self, settings: Dict) -> bool:
        """Save CWA settings to JSON file"""
        try:
            # Ensure directory exists
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Validate settings
            validated_settings = self._validate_settings(settings)
            
            with open(self.config_path, 'w') as f:
                json.dump(validated_settings, f, indent=2)
            
            logger.info("CWA settings saved successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error saving CWA settings: {e}")
            return False
    
    def _validate_settings(self, settings: Dict) -> Dict:
        """Validate and sanitize settings"""
        validated = self.default_settings.copy()
        
        # Validate base_url
        if 'base_url' in settings:
            base_url = str(settings['base_url']).strip()
            if base_url and not base_url.startswith(('http://', 'https://')):
                base_url = f'http://{base_url}'
            validated['base_url'] = base_url
        
        # Validate string fields
        for field in ['username', 'password']:
            if field in settings:
                validated[field] = str(settings[field]).strip()
        
        # Validate boolean fields
        for field in ['enabled', 'verify_ssl']:
            if field in settings:
                validated[field] = bool(settings[field])
        
        # Validate timeout
        if 'timeout' in settings:
            try:
                timeout = int(settings['timeout'])
                validated['timeout'] = max(5, min(300, timeout))  # Between 5-300 seconds
            except (ValueError, TypeError):
                pass  # Keep default
        
        return validated
    
    def test_connection(self, settings: Dict = None) -> Dict:
        """Test connection to CWA with given settings"""
        if settings is None:
            settings = self.load_settings()
        
        if not settings.get('enabled', False):
            return {
                'success': False,
                'error': 'CWA integration is disabled'
            }
        
        try:
            import requests
            from urllib.parse import urljoin
            
            base_url = settings.get('base_url', '')
            if not base_url:
                return {
                    'success': False,
                    'error': 'Base URL is required'
                }
            
            # Ensure URL ends with /
            if not base_url.endswith('/'):
                base_url += '/'
            
            # Test basic connectivity
            response = requests.get(
                base_url,
                timeout=settings.get('timeout', 30),
                verify=settings.get('verify_ssl', True),
                allow_redirects=True
            )
            
            if response.status_code == 200:
                # Try to detect if it's actually CWA
                if 'calibre-web' in response.text.lower():
                    return {
                        'success': True,
                        'message': 'Successfully connected to Calibre-Web-Automated',
                        'version': self._extract_version(response.text)
                    }
                else:
                    return {
                        'success': True,
                        'message': 'Connected to server (unable to verify it\'s CWA)',
                        'warning': 'Server response doesn\'t appear to be Calibre-Web-Automated'
                    }
            else:
                return {
                    'success': False,
                    'error': f'Server returned status code: {response.status_code}'
                }
                
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'error': 'Unable to connect to server. Check URL and network connectivity.'
            }
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'Connection timed out. Try increasing the timeout value.'
            }
        except requests.exceptions.SSLError:
            return {
                'success': False,
                'error': 'SSL verification failed. Try disabling SSL verification for self-signed certificates.'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Connection test failed: {str(e)}'
            }
    
    def _extract_version(self, html_content: str) -> Optional[str]:
        """Try to extract CWA version from HTML"""
        try:
            import re
            # Look for version patterns in HTML
            version_patterns = [
                r'calibre-web-automated[^>]*?v?(\d+\.\d+\.\d+)',
                r'version["\s]*:?["\s]*(\d+\.\d+\.\d+)',
                r'cwa[^>]*?v?(\d+\.\d+\.\d+)'
            ]
            
            for pattern in version_patterns:
                match = re.search(pattern, html_content, re.IGNORECASE)
                if match:
                    return match.group(1)
            
            return None
        except:
            return None
    
    def get_current_settings(self) -> Dict:
        """Get current settings (for API responses)"""
        settings = self.load_settings()
        # Don't return password in API responses
        api_settings = settings.copy()
        if 'password' in api_settings:
            api_settings['password'] = '***' if api_settings['password'] else ''
        return api_settings
    
    def update_env_vars(self, settings: Dict = None):
        """Update environment variables with current settings (for runtime use)"""
        if settings is None:
            settings = self.load_settings()
        
        # Update environment variables that the CWA client uses
        os.environ['CWA_BASE_URL'] = settings.get('base_url', 'http://localhost:8083')
        os.environ['CWA_USERNAME'] = settings.get('username', '')
        os.environ['CWA_PASSWORD'] = settings.get('password', '')


# Global instance
cwa_settings = CWASettings()

