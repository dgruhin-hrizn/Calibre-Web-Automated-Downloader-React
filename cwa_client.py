# CWA API Client for integration with existing Calibre-Web-Automated instance
# This provides a clean interface to interact with CWA's API endpoints

import requests
import json
import logging
from typing import Optional, Dict, List, Any
from urllib.parse import urljoin
import os
from env import CWA_BASE_URL, CWA_USERNAME, CWA_PASSWORD

logger = logging.getLogger(__name__)

class CWAClient:
    """Client for interacting with Calibre-Web-Automated API"""
    
    def __init__(self, base_url: str = None, username: str = None, password: str = None):
        self.base_url = base_url or CWA_BASE_URL
        self.username = username or CWA_USERNAME
        self.password = password or CWA_PASSWORD
        self.session = requests.Session()
        self.authenticated = False
        
        # Ensure base_url ends with /
        if not self.base_url.endswith('/'):
            self.base_url += '/'
    
    def authenticate(self) -> bool:
        """Authenticate with CWA instance"""
        if not self.username or not self.password:
            logger.warning("No CWA credentials provided, attempting anonymous access")
            return True
            
        try:
            login_url = urljoin(self.base_url, 'login')
            response = self.session.post(login_url, data={
                'username': self.username,
                'password': self.password,
                'submit': 'Sign in',
                'next': '/'
            }, allow_redirects=False)
            
            self.authenticated = response.status_code in [200, 302]
            if self.authenticated:
                logger.info("Successfully authenticated with CWA")
            else:
                logger.error(f"CWA authentication failed: {response.status_code}")
            
            return self.authenticated
            
        except Exception as e:
            logger.error(f"Error authenticating with CWA: {e}")
            return False
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
        """Make authenticated request to CWA"""
        if not self.authenticated and self.username:
            if not self.authenticate():
                return None
        
        url = urljoin(self.base_url, endpoint.lstrip('/'))
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            logger.error(f"CWA API request failed: {method} {url} - {e}")
            return None
    
    def get_books(self, page: int = 1, per_page: int = 25, sort: str = 'new') -> Optional[Dict]:
        """Get books from CWA library"""
        params = {
            'page': page,
            'per_page': per_page,
            'sort': sort
        }
        
        response = self._make_request('GET', f'/', params=params)
        if response:
            # CWA returns HTML, we'd need to parse it or use their JSON endpoints
            # Let's try the OPDS feed which returns structured data
            return self.get_opds_books(page, per_page)
        return None
    
    def get_opds_books(self, page: int = 1, per_page: int = 25) -> Optional[Dict]:
        """Get books via OPDS feed (structured data)"""
        response = self._make_request('GET', f'/opds')
        if response:
            # Parse OPDS XML response
            return self._parse_opds_response(response.text)
        return None
    
    def search_books(self, query: str, page: int = 1) -> Optional[Dict]:
        """Search books in CWA library"""
        params = {
            'query': query,
            'page': page
        }
        
        response = self._make_request('GET', f'/search', params=params)
        if response:
            return self._parse_search_response(response.text)
        return None
    
    def get_book_details(self, book_id: int) -> Optional[Dict]:
        """Get detailed information about a specific book"""
        response = self._make_request('GET', f'/book/{book_id}')
        if response:
            return self._parse_book_details(response.text)
        return None
    
    def get_book_formats(self, book_id: int) -> Optional[List[Dict]]:
        """Get available formats for a book"""
        response = self._make_request('GET', f'/book/{book_id}')
        if response:
            return self._parse_book_formats(response.text)
        return None
    
    def download_book(self, book_id: int, format: str = 'epub') -> Optional[bytes]:
        """Download a book in specified format"""
        response = self._make_request('GET', f'/download/{book_id}/{format}')
        if response:
            return response.content
        return None
    
    def get_reader_url(self, book_id: int, format: str = 'epub') -> str:
        """Get URL for reading a book in CWA's web reader"""
        return urljoin(self.base_url, f'read/{book_id}/{format}')
    
    def get_cover_url(self, book_id: int) -> str:
        """Get URL for book cover image"""
        return urljoin(self.base_url, f'cover/{book_id}')
    
    def get_authors(self) -> Optional[List[Dict]]:
        """Get list of authors"""
        response = self._make_request('GET', f'/author')
        if response:
            return self._parse_authors(response.text)
        return None
    
    def get_series(self) -> Optional[List[Dict]]:
        """Get list of book series"""
        response = self._make_request('GET', f'/series')
        if response:
            return self._parse_series(response.text)
        return None
    
    def get_categories(self) -> Optional[List[Dict]]:
        """Get list of categories/tags"""
        response = self._make_request('GET', f'/category')
        if response:
            return self._parse_categories(response.text)
        return None
    
    def check_connection(self) -> bool:
        """Check if CWA instance is accessible"""
        try:
            response = self.session.get(urljoin(self.base_url, '/'), timeout=5)
            return response.status_code == 200
        except:
            return False
    
    # Helper methods for parsing HTML responses
    def _parse_opds_response(self, xml_content: str) -> Dict:
        """Parse OPDS XML feed"""
        # TODO: Implement XML parsing for OPDS
        return {'books': [], 'total': 0}
    
    def _parse_search_response(self, html_content: str) -> Dict:
        """Parse search results from HTML"""
        # TODO: Implement HTML parsing for search results
        return {'books': [], 'total': 0}
    
    def _parse_book_details(self, html_content: str) -> Dict:
        """Parse book details from HTML"""
        # TODO: Implement HTML parsing for book details
        return {}
    
    def _parse_book_formats(self, html_content: str) -> List[Dict]:
        """Parse available book formats from HTML"""
        # TODO: Implement HTML parsing for formats
        return []
    
    def _parse_authors(self, html_content: str) -> List[Dict]:
        """Parse authors list from HTML"""
        # TODO: Implement HTML parsing for authors
        return []
    
    def _parse_series(self, html_content: str) -> List[Dict]:
        """Parse series list from HTML"""
        # TODO: Implement HTML parsing for series
        return []
    
    def _parse_categories(self, html_content: str) -> List[Dict]:
        """Parse categories list from HTML"""
        # TODO: Implement HTML parsing for categories
        return []


# Convenience functions
def get_cwa_client() -> CWAClient:
    """Get configured CWA client instance"""
    return CWAClient()

def test_cwa_connection(base_url: str = None) -> bool:
    """Test connection to CWA instance"""
    client = CWAClient(base_url=base_url)
    return client.check_connection()
