"""Flask web application for book download service with URL rewrite support."""

import logging
import io, re, os
import sqlite3
import requests
from functools import wraps
from flask import Flask, request, jsonify, render_template, send_file, send_from_directory, session
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash
from werkzeug.wrappers import Response
from flask import url_for as flask_url_for
import typing

from ..infrastructure.logger import setup_logger
from ..infrastructure.config import _SUPPORTED_BOOK_LANGUAGE, BOOK_LANGUAGE
from ..infrastructure.env import FLASK_HOST, FLASK_PORT, APP_ENV, CWA_DB_PATH, DEBUG, USING_EXTERNAL_BYPASSER, BUILD_VERSION, RELEASE_VERSION, CALIBRE_LIBRARY_PATH, DOWNLOADS_DB_PATH, INGEST_DIR
from ..core import backend

from ..integrations.cwa.client import CWAClient
from ..integrations.cwa.settings import cwa_settings
from ..integrations.cwa.proxy import CWAProxy, create_cwa_proxy_routes, create_opds_routes
from ..integrations.calibre.db_manager import CalibreDBManager
from ..integrations.calibre.read_status_manager import get_read_status_manager
from ..infrastructure.downloads_db import DownloadsDBManager
from ..infrastructure.uploads_db import UploadsDBManager
from ..utils.rate_limiter import get_rate_limiter_stats

from ..core.models import SearchFilters

logger = setup_logger(__name__)
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app)  # type: ignore
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching
app.config['APPLICATION_ROOT'] = '/'

# Configure Flask sessions - Primary app session
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'cwa-downloader-secret-key-change-in-production')
app.config['SESSION_COOKIE_NAME'] = 'cwa_app_session'  # Main application session
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours

# Enable CORS for React frontend
# In production, CORS isn't needed since frontend is served from same origin
# In development, allow localhost origins for Vite dev server
cors_origins = []
if APP_ENV in ['development', 'dev']:
    cors_origins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        # Add specific local network IPs as needed
        'http://192.168.1.129:5173',
        # You can add more IPs here for other devices
    ]

if APP_ENV in ['development', 'dev']:
    # Development: Allow local network origins with pattern matching
    CORS(app, 
         origins=cors_origins,
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # Add a custom CORS handler for more flexibility
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        if origin:
            # Check if origin is from local network
            import re
            if (origin.startswith('http://localhost:') or 
                origin.startswith('http://127.0.0.1:') or
                re.match(r'http://192\.168\.\d+\.\d+:\d+', origin) or
                re.match(r'http://10\.\d+\.\d+\.\d+:\d+', origin) or
                re.match(r'http://172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+', origin)):
                
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        return response
else:
    # Production: No CORS needed (same origin)
    pass

# Initialize Calibre DB manager for direct database access
calibre_db_manager = None

# Initialize Downloads DB manager for per-user download tracking
downloads_db_manager = None

# Initialize Read Status Manager for user reading status
read_status_manager = None

# Flask logger
app.logger.handlers = logger.handlers
app.logger.setLevel(logger.level)
# Also handle Werkzeug's logger
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.handlers = logger.handlers
werkzeug_logger.setLevel(logger.level)

# Configure secondary session for CWA proxy authentication
# This creates a second session cookie with different settings
import os

# Create a secondary session interface for proxy authentication
class DualSessionApp:
    """Helper class to manage dual session cookies"""
    
    def __init__(self, app):
        self.app = app
        self.proxy_session_config = {
            'SECRET_KEY': os.urandom(32),  # Different secret key for proxy session
            'SESSION_COOKIE_NAME': 'cwa_proxy_session',
            'SESSION_COOKIE_HTTPONLY': True,
            'SESSION_COOKIE_SECURE': False,
            'SESSION_COOKIE_SAMESITE': 'Lax',
            'PERMANENT_SESSION_LIFETIME': 86400
        }
    
    def create_proxy_session_cookie(self, response, username, cwa_password):
        """Create the second session cookie for CWA proxy authentication"""
        try:
            from itsdangerous import URLSafeTimedSerializer
            
            # Create serializer with proxy session secret
            serializer = URLSafeTimedSerializer(self.proxy_session_config['SECRET_KEY'])
            
            # Create proxy session data
            proxy_session_data = {
                'username': username,
                'cwa_password': cwa_password,
                'logged_in': True,
                'session_type': 'cwa_proxy'
            }
            
            # Serialize the session data
            session_value = serializer.dumps(proxy_session_data)
            
            # Set the second cookie
            response.set_cookie(
                self.proxy_session_config['SESSION_COOKIE_NAME'],
                session_value,
                max_age=self.proxy_session_config['PERMANENT_SESSION_LIFETIME'],
                httponly=self.proxy_session_config['SESSION_COOKIE_HTTPONLY'],
                secure=self.proxy_session_config['SESSION_COOKIE_SECURE'],
                samesite=self.proxy_session_config['SESSION_COOKIE_SAMESITE']
            )
            logger.info(f"Created proxy session cookie for user: {username}")
            
        except Exception as e:
            logger.error(f"Failed to create proxy session cookie: {e}")

# Initialize dual session manager
dual_session_manager = DualSessionApp(app)

# Helper function for getting project root path
def get_project_root():
    """Get the project root directory (two levels up from src/api/)"""
    return os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

# Initialize CWA client with settings
def get_cwa_client():
    """Get CWA client with current settings"""
    settings = cwa_settings.load_settings()
    if settings.get('enabled', False):
        return CWAClient(
            base_url=settings.get('base_url'),
            username=settings.get('username'),
            password=settings.get('password')
        )
    return None

def get_calibre_db_manager():
    """Get or create Calibre DB manager instance"""
    global calibre_db_manager
    if calibre_db_manager is None:
        metadata_db_path = CALIBRE_LIBRARY_PATH / 'metadata.db'
        if metadata_db_path.exists():
            calibre_db_manager = CalibreDBManager(str(metadata_db_path))
        else:
            logger.warning(f"Calibre metadata.db not found at {metadata_db_path}")
    return calibre_db_manager

def get_downloads_db_manager():
    """Get or create Downloads DB manager instance"""
    global downloads_db_manager
    if downloads_db_manager is None:
        try:
            downloads_db_manager = DownloadsDBManager(DOWNLOADS_DB_PATH)
            logger.info(f"Downloads database connected: {DOWNLOADS_DB_PATH}")
        except Exception as e:
            logger.error(f"Failed to initialize downloads database: {e}")
            return None
    return downloads_db_manager

def get_read_status_manager_instance():
    """Get or initialize read status manager"""
    global read_status_manager
    if read_status_manager is None:
        try:
            # Use CWA's app.db for read status tracking
            from ..infrastructure.env import CWA_USER_DB_PATH
            if CWA_USER_DB_PATH.exists():
                read_status_manager = get_read_status_manager(str(CWA_USER_DB_PATH))
                logger.info(f"Read status manager connected: {CWA_USER_DB_PATH}")
            else:
                logger.warning(f"CWA app.db not found at {CWA_USER_DB_PATH}")
        except Exception as e:
            logger.error(f"Failed to initialize read status manager: {e}")
            read_status_manager = None
    return read_status_manager

def enrich_books_with_read_status(books_data, username=None):
    """Enrich book data with read status information for the current user"""
    if not username or not books_data:
        return books_data
    
    try:
        rs_manager = get_read_status_manager_instance()
        if not rs_manager:
            return books_data
        
        # Get user ID
        user_id = rs_manager.get_or_create_user(username)
        
        # Extract book IDs
        book_ids = [book['id'] for book in books_data if 'id' in book]
        if not book_ids:
            return books_data
        
        # Get read status for all books
        read_statuses = rs_manager.get_multiple_books_read_status(book_ids, user_id)
        
        # Enrich each book with read status
        for book in books_data:
            book_id = book.get('id')
            if book_id and book_id in read_statuses:
                status_info = read_statuses[book_id]
                book['read_status'] = {
                    'is_read': status_info['is_read'],
                    'is_in_progress': status_info['is_in_progress'],
                    'status_code': status_info['read_status'],
                    'last_modified': status_info['last_modified'],
                    'times_started_reading': status_info['times_started_reading']
                }
            else:
                # Default to unread if no status found
                book['read_status'] = {
                    'is_read': False,
                    'is_in_progress': False,
                    'status_code': 0,
                    'last_modified': None,
                    'times_started_reading': 0
                }
        
        return books_data
        
    except Exception as e:
        logger.error(f"Error enriching books with read status: {e}")
        return books_data

# Global uploads DB manager instance
uploads_db_manager = None

def get_uploads_db_manager():
    """Get or create Uploads DB manager instance"""
    global uploads_db_manager
    if uploads_db_manager is None:
        try:
            uploads_db_path = DOWNLOADS_DB_PATH.parent / "uploads.db"
            uploads_db_manager = UploadsDBManager(uploads_db_path)
            logger.info(f"Uploads database connected: {uploads_db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize uploads database: {e}")
            return None
    return uploads_db_manager

# Initialize with current settings
cwa_client = get_cwa_client()

# Direct CWA database integration removed - using proxy approach instead

# Initialize CWA proxy using settings from env.py
from ..infrastructure.env import CWA_BASE_URL, CWA_USERNAME, CWA_PASSWORD
CWA_URL = CWA_BASE_URL
CWA_USER = CWA_USERNAME if CWA_USERNAME else None
CWA_PASS = CWA_PASSWORD if CWA_PASSWORD else None

try:
    # Initialize CWA proxy with multi-user support
    cwa_proxy = CWAProxy(CWA_URL)
    logger.info(f"✅ CWA proxy initialized for: {CWA_URL}")
    # Add CWA proxy routes
    create_cwa_proxy_routes(app, cwa_proxy)
    # Add OPDS proxy routes
    create_opds_routes(app, cwa_proxy)
    logger.info("✅ OPDS proxy routes created successfully")
except Exception as e:
    logger.error(f"Error initializing CWA proxy: {e}")
    cwa_proxy = None

def require_cwa_client():
    """Decorator to ensure CWA client is available"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client = get_cwa_client()
            if not client:
                return jsonify({'error': 'CWA integration is disabled'}), 503
            return f(client, *args, **kwargs)
        return decorated_function
    return decorator

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Always allow frontend routes (for serving React app)
        if request.endpoint in ['index', 'catch_all', 'react_assets']:
            return f(*args, **kwargs)
            
        # Skip authentication if DISABLE_AUTH is set (for testing/development)
        disable_auth = os.environ.get('DISABLE_AUTH', 'false').lower()
        if disable_auth == 'true':
            return f(*args, **kwargs)
            
        # If the CWA database doesn't exist yet, allow any credentials (first run)
        if not CWA_DB_PATH.exists():
            logger.info(f"CWA database not found at {CWA_DB_PATH} - allowing any credentials for first run")
            # Don't return error - let it fall through to session check
        
        # Check if user is logged in via session
        if not session.get('logged_in') or not session.get('username'):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # First check if user is logged in
        if not session.get('logged_in') or not session.get('username'):
            return jsonify({"error": "Authentication required"}), 401
        
        # Check admin status via CWA
        try:
            client = get_cwa_client()
            if not client:
                return jsonify({'error': 'CWA not configured'}), 400
                
            response = client.get('/admin/view')
            if response.status_code != 200:
                return jsonify({"error": "Admin privileges required"}), 403
                
        except Exception as e:
            logger.error(f"Error checking admin status: {e}")
            return jsonify({"error": "Admin verification failed"}), 403
            
        return f(*args, **kwargs)
    return decorated_function

def register_dual_routes(app : Flask) -> None:
    """
    Register each route both with and without the /request prefix.
    This function should be called after all routes are defined.
    """
    # Store original url_map rules
    rules = list(app.url_map.iter_rules())
    
    # Add /request prefix to each rule
    for rule in rules:
        if rule.rule != '/request/' and rule.rule != '/request':  # Skip if it's already a request route
            # Create new routes with /request prefix, both with and without trailing slash
            base_rule = rule.rule[:-1] if rule.rule.endswith('/') else rule.rule
            if base_rule == '':  # Special case for root path
                app.add_url_rule('/request', f"root_request", 
                               view_func=app.view_functions[rule.endpoint],
                               methods=rule.methods)
                app.add_url_rule('/request/', f"root_request_slash", 
                               view_func=app.view_functions[rule.endpoint],
                               methods=rule.methods)
            else:
                app.add_url_rule(f"/request{base_rule}", 
                               f"{rule.endpoint}_request",
                               view_func=app.view_functions[rule.endpoint],
                               methods=rule.methods)
                app.add_url_rule(f"/request{base_rule}/", 
                               f"{rule.endpoint}_request_slash",
                               view_func=app.view_functions[rule.endpoint],
                               methods=rule.methods)
    app.jinja_env.globals['url_for'] = url_for_with_request

def url_for_with_request(endpoint : str, **values : typing.Any) -> str:
    """Generate URLs with /request prefix by default."""
    if endpoint == 'static':
        # For static files, add /request prefix
        url = flask_url_for(endpoint, **values)
        return f"/request{url}"
    return flask_url_for(endpoint, **values)

# Initialize downloads database on module load
try:
    downloads_db_startup = get_downloads_db_manager()
    if downloads_db_startup:
        logger.info("Downloads database initialized successfully on startup")
    else:
        logger.warning("Downloads database failed to initialize on startup")
except Exception as e:
    logger.error(f"Error initializing downloads database on startup: {e}")

@app.route('/')
def index():
    """
    Serve React frontend for the root route (Library page).
    Note: No @login_required decorator - authentication is handled by React ProtectedRoute
    """
    return serve_react_app()

# Helper function for serving React app
def serve_react_app():
    """Helper function to serve the React app"""
    project_root = get_project_root()
    react_build_path = os.path.join(project_root, 'frontend', 'dist', 'index.html')
    
    if os.path.exists(react_build_path):
        return send_file(react_build_path)
    
    # Fallback to 404 if no React build found
    logger.error(f"Frontend not built - React build not found at: {react_build_path}")
    return "Frontend not built", 404

# React page routes - each corresponds to a route in App.tsx
# Note: No @login_required decorator - authentication is handled by React ProtectedRoute
@app.route('/stats')
def stats_page():
    """Serve React app for /stats page"""
    return serve_react_app()

@app.route('/search')
def search_page():
    """Serve React app for /search page"""
    return serve_react_app()

@app.route('/library')
def library_page():
    """Serve React app for /library page"""
    return serve_react_app()

@app.route('/series')
def series_page():
    """Serve React app for /series page"""
    return serve_react_app()

@app.route('/hot')
def hot_page():
    """Serve React app for /hot page"""
    return serve_react_app()

@app.route('/downloads')
def downloads_page():
    """Serve React app for /downloads page"""
    return serve_react_app()

@app.route('/settings')
def settings_page():
    """Serve React app for /settings page"""
    return serve_react_app()

@app.route('/profile')
def profile_page():
    """Serve React app for /profile page"""
    return serve_react_app()

@app.route('/admin')
def admin_page():
    """Serve React app for /admin page"""
    return serve_react_app()

# Serve React static files
@app.route('/assets/<path:filename>')
def react_assets(filename):
    """Serve React build assets."""
    # Use project root for correct path
    assets_path = os.path.join(get_project_root(), 'frontend', 'dist', 'assets')
    return send_from_directory(assets_path, filename)

# Serve static files from static/media directory
@app.route('/static/media/<path:filename>')
@app.route('/request/static/media/<path:filename>')
def static_media(filename):
    """Serve static media files (images, icons, etc.)"""
    # Use project root for correct path
    static_media_path = os.path.join(get_project_root(), 'static', 'media')
    return send_from_directory(static_media_path, filename)

# Serve files directly from root (for legacy compatibility)
@app.route('/<filename>')
@app.route('/request/<filename>')
def root_static_files(filename):
    """Serve static files directly from root for legacy compatibility (like droplet.png)"""
    logger.info(f"Static file requested: {filename}")
    
    # Only serve specific file types to avoid conflicts with SPA routing
    if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.css', '.js')):
        logger.info(f"File type not allowed for static serving: {filename}")
        return "Not Found", 404
    
    # Check static/media directory first
    static_media_path = os.path.join(get_project_root(), 'static', 'media')
    static_file_path = os.path.join(static_media_path, filename)
    
    logger.info(f"Checking static/media path: {static_file_path}")
    if os.path.exists(static_file_path):
        logger.info(f"Serving from static/media: {filename}")
        return send_from_directory(static_media_path, filename)
    
    # Check frontend/public directory
    frontend_public_path = os.path.join(get_project_root(), 'frontend', 'public')
    public_file_path = os.path.join(frontend_public_path, filename)
    
    logger.info(f"Checking frontend/public path: {public_file_path}")
    if os.path.exists(public_file_path):
        logger.info(f"Serving from frontend/public: {filename}")
        return send_from_directory(frontend_public_path, filename)
    
    logger.warning(f"Static file not found: {filename}")
    return "Not Found", 404

@app.route('/favicon.ico')
@app.route('/droplet.png')
@app.route('/favico<path:_>')
@app.route('/request/favico<path:_>')
@app.route('/request/static/favico<path:_>')
def favicon(_ : typing.Any = None) -> Response:
    """Serve favicon - always serve droplet.png for consistency"""
    return send_from_directory(os.path.join(get_project_root(), 'frontend', 'dist'),
        'droplet.png', mimetype='image/png')

from typing import Union, Tuple

if DEBUG:
    import subprocess
    import time
    if USING_EXTERNAL_BYPASSER:
        STOP_GUI = lambda: None  # No-op for external bypasser
    else:
        from ..utils.cloudflare.bypasser import _reset_driver as STOP_GUI
    @app.route('/debug', methods=['GET'])
    @login_required
    def debug() -> Union[Response, Tuple[Response, int]]:
        """
        This will run the /app/debug.sh script, which will generate a debug zip with all the logs
        The file will be named /tmp/cwa-book-downloader-debug.zip
        And then return it to the user
        """
        try:
            # Run the debug script
            STOP_GUI()
            time.sleep(1)
            result = subprocess.run(['/app/genDebug.sh'], capture_output=True, text=True, check=True)
            if result.returncode != 0:
                raise Exception(f"Debug script failed: {result.stderr}")
            logger.info(f"Debug script executed: {result.stdout}")
            debug_file_path = result.stdout.strip().split('\n')[-1]
            if not os.path.exists(debug_file_path):
                logger.error("Debug zip file not found after running debug script")
                return jsonify({"error": "Failed to generate debug information"}), 500
                
            # Return the file to the user
            return send_file(
                debug_file_path,
                mimetype='application/zip',
                download_name=os.path.basename(debug_file_path),
                as_attachment=True
            )
        except subprocess.CalledProcessError as e:
            logger.error_trace(f"Debug script error: {e}, stdout: {e.stdout}, stderr: {e.stderr}")
            return jsonify({"error": f"Debug script failed: {e.stderr}"}), 500
        except Exception as e:
            logger.error_trace(f"Debug endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

if DEBUG:
    @app.route('/api/restart', methods=['GET'])
    @login_required
    def restart() -> Union[Response, Tuple[Response, int]]:
        """
        Restart the application
        """
        os._exit(0)

@app.route('/api/login', methods=['POST'])
def api_login() -> Union[Response, Tuple[Response, int]]:
    """
    Login endpoint that authenticates with CWA first, then creates local session.
    
    Expected JSON body:
    {
        "username": "user",
        "password": "pass"
    }
    
    Returns:
        JSON with login status and user info
    """
    try:
        # Clear any existing session first (handles invalid sessions from rebuilds)
        session.clear()
        
        data = request.get_json()
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({"error": "Username and password required"}), 400
        
        username = data['username']
        password = data['password']
        
        # First, try to authenticate with CWA (authoritative source)
        if cwa_proxy:
            logger.info(f"Attempting CWA authentication for user: {username}")
            
            # Create a temporary user session to test CWA login
            from ..integrations.cwa.proxy import CWAUserSession
            temp_session = CWAUserSession(username, password, cwa_proxy.cwa_base_url)
            
            if cwa_proxy._login_user_session(temp_session):
                # CWA login successful - now create our local session
                session['logged_in'] = True
                session['username'] = username
                session['cwa_password'] = password  # Store for ongoing CWA requests
                session.permanent = True
                
                # Store the CWA session for this user
                with cwa_proxy.sessions_lock:
                    cwa_proxy.user_sessions[username] = temp_session
                
                logger.info(f"User {username} logged in successfully via CWA")
                
                # Create the response
                response = jsonify({
                    "success": True,
                    "user": {"username": username}
                })
                
                # Create the second session cookie for CWA proxy
                dual_session_manager.create_proxy_session_cookie(response, username, password)
                
                return response
            else:
                logger.warning(f"CWA authentication failed for user: {username}")
                return jsonify({"error": "Invalid username or password"}), 401
        else:
            # CWA proxy not available - this should be an error, not a fallback
            logger.error("CWA proxy not available - cannot authenticate users without CWA")
            return jsonify({
                "error": "Authentication service unavailable",
                "message": "CWA connection required for authentication"
            }), 503
            
    except Exception as e:
        logger.error_trace(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500

@app.route('/api/logout', methods=['POST'])
def api_logout() -> Union[Response, Tuple[Response, int]]:
    """
    Logout endpoint to clear session.
    
    Returns:
        JSON with logout status
    """
    try:
        username = session.get('username', 'unknown')
        
        # Clear CWA session if we have one
        if hasattr(cwa_proxy, 'user_sessions') and username != 'unknown':
            with cwa_proxy.sessions_lock:
                if username in cwa_proxy.user_sessions:
                    logger.info(f"Clearing CWA session for user: {username}")
                    del cwa_proxy.user_sessions[username]
        
        session.clear()
        logger.info(f"User {username} logged out")
        
        # Create response and clear both session cookies
        response = jsonify({"success": True})
        
        # Clear the main app session cookie (Flask handles this automatically with session.clear())
        # Clear the proxy session cookie manually
        response.set_cookie(
            dual_session_manager.proxy_session_config['SESSION_COOKIE_NAME'],
            '',
            expires=0,
            httponly=dual_session_manager.proxy_session_config['SESSION_COOKIE_HTTPONLY'],
            secure=dual_session_manager.proxy_session_config['SESSION_COOKIE_SECURE'],
            samesite=dual_session_manager.proxy_session_config['SESSION_COOKIE_SAMESITE']
        )
        
        return response
    except Exception as e:
        logger.error_trace(f"Logout error: {e}")
        return jsonify({"error": "Logout failed"}), 500

@app.route('/api/auth/check', methods=['GET'])
def api_auth_check() -> Union[Response, Tuple[Response, int]]:
    """
    Lightweight authentication check endpoint.
    
    Returns:
        JSON with authentication status and user info
    """
    try:
        if session.get('logged_in') and session.get('username'):
            return jsonify({
                "authenticated": True,
                "user": {"username": session.get('username')}
            })
        else:
            return jsonify({"authenticated": False}), 401
    except Exception as e:
        logger.error_trace(f"Auth check error: {e}")
        return jsonify({"authenticated": False}), 401

@app.route('/api/debug/session', methods=['GET'])
@login_required
def debug_session() -> Union[Response, Tuple[Response, int]]:
    """
    Debug endpoint to check session state.
    """
    try:
        session_data = {
            "logged_in": session.get('logged_in'),
            "username": session.get('username'),
            "has_cwa_password": bool(session.get('cwa_password')),
            "session_keys": list(session.keys()),
            "cwa_proxy_sessions": len(cwa_proxy.user_sessions) if cwa_proxy else 0
        }
        return jsonify(session_data)
    except Exception as e:
        logger.error_trace(f"Session debug error: {e}")
        return jsonify({"error": "Session debug failed"}), 500

@app.route('/api/search', methods=['GET'])
@login_required
def api_search() -> Union[Response, Tuple[Response, int]]:
    """
    Search for books matching the provided query.

    Query Parameters:
        query (str): Search term (ISBN, title, author, etc.)
        isbn (str): Book ISBN
        author (str): Book Author
        title (str): Book Title
        lang (str): Book Language
        sort (str): Order to sort results
        content (str): Content type of book
        format (str): File format filter (pdf, epub, mobi, azw3, fb2, djvu, cbz, cbr)

    Returns:
        flask.Response: JSON array of matching books or error response.
    """
    query = request.args.get('query', '')

    filters = SearchFilters(
        isbn = request.args.getlist('isbn'),
        author = request.args.getlist('author'),
        title = request.args.getlist('title'),
        lang = request.args.getlist('lang'),
        sort = request.args.get('sort'),
        content = request.args.getlist('content'),
        format = request.args.getlist('format'),
    )

    if not query and not any(vars(filters).values()):
        return jsonify([])

    try:
        books = backend.search_books(query, filters)
        return jsonify(books)
    except Exception as e:
        logger.error_trace(f"Search error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/info', methods=['GET'])
@login_required
def api_info() -> Union[Response, Tuple[Response, int]]:
    """
    Get detailed book information.

    Query Parameters:
        id (str): Book identifier (MD5 hash)

    Returns:
        flask.Response: JSON object with book details, or an error message.
    """
    book_id = request.args.get('id', '')
    if not book_id:
        return jsonify({"error": "No book ID provided"}), 400

    try:
        book = backend.get_book_info(book_id)
        if book:
            return jsonify(book)
        return jsonify({"error": "Book not found"}), 404
    except Exception as e:
        logger.error_trace(f"Info error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/google-books', methods=['GET', 'POST'])
@login_required
def api_google_books_settings() -> Union[Response, Tuple[Response, int]]:
    """
    Get or set Google Books API settings.
    
    GET: Returns current Google Books API settings
    POST: Updates Google Books API settings
    
    Returns:
        flask.Response: JSON object with settings or confirmation message
    """
    if request.method == 'GET':
        try:
            settings = backend.get_google_books_settings()
            return jsonify(settings)
        except Exception as e:
            logger.error_trace(f"Error getting Google Books settings: {e}")
            return jsonify({"error": str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            api_key = data.get('apiKey', '')
            is_valid = data.get('isValid', False)
            
            backend.save_google_books_settings(api_key, is_valid)
            return jsonify({"message": "Google Books API settings saved successfully"})
        except Exception as e:
            logger.error_trace(f"Error saving Google Books settings: {e}")
            return jsonify({"error": str(e)}), 500

@app.route('/api/settings/google-books/test', methods=['POST'])
@login_required
def api_test_google_books_key() -> Union[Response, Tuple[Response, int]]:
    """
    Test Google Books API key validity.
    
    Returns:
        flask.Response: JSON object with validity status
    """
    try:
        data = request.get_json()
        api_key = data.get('apiKey', '')
        
        is_valid = backend.test_google_books_api_key(api_key)
        return jsonify({"valid": is_valid})
    except Exception as e:
        logger.error_trace(f"Error testing Google Books API key: {e}")
        return jsonify({"valid": False, "error": str(e)}), 500

@app.route('/api/google-books/search', methods=['POST'])
@login_required
def api_google_books_search() -> Union[Response, Tuple[Response, int]]:
    """
    Search Google Books API for book information.
    
    Returns:
        flask.Response: JSON object with Google Books data
    """
    try:
        data = request.get_json()
        title = data.get('title', '')
        author = data.get('author', '')
        max_results = data.get('maxResults', 1)
        
        logger.info(f"Google Books search request: title='{title}', author='{author}', maxResults={max_results}")
        
        google_data = backend.search_google_books(title, author, max_results=max_results)
        if google_data:
            logger.info(f"Google Books search successful for '{title}'")
            return jsonify(google_data)
        else:
            logger.info(f"No Google Books data found for '{title}'")
            return jsonify({"error": "No Google Books data found"}), 404
    except Exception as e:
        logger.error_trace(f"Error searching Google Books: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/google-books/volume/<volume_id>', methods=['GET'])
@login_required
def api_google_books_volume_details(volume_id: str) -> Union[Response, Tuple[Response, int]]:
    """
    Get detailed Google Books volume information by volume ID.
    
    Returns:
        flask.Response: JSON object with detailed Google Books volume data
    """
    try:
        logger.info(f"Google Books volume details request for ID: {volume_id}")
        
        volume_data = backend.get_google_books_volume_details(volume_id)
        if volume_data:
            logger.info(f"Google Books volume details successful for '{volume_id}'")
            return jsonify(volume_data)
        else:
            logger.info(f"No Google Books volume data found for '{volume_id}'")
            return jsonify({"error": "No Google Books volume data found"}), 404
    except Exception as e:
        logger.error_trace(f"Error getting Google Books volume details: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/book-details/<book_id>', methods=['GET', 'POST'])
@login_required
def api_enhanced_book_details(book_id: str) -> Union[Response, Tuple[Response, int]]:
    """
    Get enhanced book details with Google Books API data.
    
    Args:
        book_id: Book identifier (MD5 hash)
    
    Returns:
        flask.Response: JSON object with enhanced book details
    """
    try:
        # Check if basic book info is provided in POST body to avoid re-fetching
        basic_book_info = None
        if request.method == 'POST':
            data = request.get_json()
            if data and 'basicBookInfo' in data:
                basic_book_info = data['basicBookInfo']
                logger.info("Using provided basic book info from request body")
        
        enhanced_details = backend.get_enhanced_book_details(book_id, basic_book_info)
        if enhanced_details:
            return jsonify(enhanced_details)
        return jsonify({"error": "Book not found"}), 404
    except Exception as e:
        logger.error_trace(f"Error getting enhanced book details: {e}")
        return jsonify({"error": str(e)}), 500



@app.route('/api/download', methods=['GET'])
@login_required
def api_download() -> Union[Response, Tuple[Response, int]]:
    """
    Queue a book for download.

    Query Parameters:
        id (str): Book identifier (MD5 hash)
        cover_url (str, optional): Book cover image URL from search results

    Returns:
        flask.Response: JSON status object indicating success or failure.
    """
    book_id = request.args.get('id', '')
    if not book_id:
        return jsonify({"error": "No book ID provided"}), 400

    try:
        priority = int(request.args.get('priority', 0))
        username = session.get('username')  # Get current user
        search_url = request.args.get('search_url', '')  # Optional search URL
        cover_url = request.args.get('cover_url', '')  # Optional cover URL from frontend
        
        success = backend.queue_book(book_id, priority, username, search_url, cover_url)
        if success:
            return jsonify({"status": "queued", "priority": priority})
        return jsonify({"error": "Failed to queue book"}), 500
    except Exception as e:
        logger.error_trace(f"Download error: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================================
# User-specific Download Tracking Endpoints
# ============================================================================

@app.route('/api/downloads/history', methods=['GET'])
@login_required
def api_user_download_history():
    """Get user's download history"""
    try:
        username = session.get('username')
        if not username:
            return jsonify({"error": "Not authenticated"}), 401
        
        downloads_db = get_downloads_db_manager()
        if not downloads_db:
            return jsonify({"error": "Downloads database not available"}), 503
        
        # Get query parameters
        status = request.args.get('status')  # Filter by status
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = int(request.args.get('offset', 0))
        
        downloads = downloads_db.get_user_downloads(username, status, limit, offset)
        return jsonify({"downloads": downloads})
        
    except Exception as e:
        logger.error(f"Error getting user download history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/downloads/status', methods=['GET'])
@login_required
def api_user_download_status():
    """Get user's downloads grouped by status with real-time progress data"""
    try:
        username = session.get('username')
        if not username:
            return jsonify({"error": "Not authenticated"}), 401
        
        downloads_db = get_downloads_db_manager()
        if not downloads_db:
            return jsonify({"error": "Downloads database not available"}), 503
        
        # Get user's database records for active statuses
        downloads_by_status = downloads_db.get_user_downloads_by_status(username)
        
        # Get global queue status for real-time progress data
        global_status = backend.queue_status()
        
        # Enrich user's active downloads with real-time data from global queue
        for status in ['queued', 'downloading', 'processing', 'waiting']:
            if status in downloads_by_status:
                enriched_downloads = []
                for db_record in downloads_by_status[status]:
                    book_id = db_record['book_id']
                    
                    # Start with database record
                    enriched_record = {
                        'id': book_id,
                        'title': db_record['book_title'],
                        'author': db_record['book_author'], 
                        'format': db_record['book_format'],
                        'cover_url': db_record['cover_url'],
                        'preview': db_record['cover_url'],  # Alias for compatibility
                        'progress': 0,
                        'status': status
                    }
                    
                    # Enrich with real-time data from global queue if available
                    queue_status_key = status if status != 'error' else 'error'
                    if queue_status_key in global_status and book_id in global_status[queue_status_key]:
                        queue_data = global_status[queue_status_key][book_id]  # This is a BookInfo object
                        enriched_record.update({
                            'progress': getattr(queue_data, 'progress', 0),
                            'wait_time': getattr(queue_data, 'wait_time', None),
                            'wait_start': getattr(queue_data, 'wait_start', None),
                            'error': getattr(queue_data, 'error', None)
                        })
                    
                    enriched_downloads.append(enriched_record)
                
                downloads_by_status[status] = enriched_downloads
        
        return jsonify(downloads_by_status)
        
    except Exception as e:
        logger.error(f"Error getting user download status: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/downloads/stats', methods=['GET'])
@login_required
def api_user_download_stats():
    """Get user's download statistics"""
    try:
        username = session.get('username')
        if not username:
            return jsonify({"error": "Not authenticated"}), 401
        
        downloads_db = get_downloads_db_manager()
        if not downloads_db:
            return jsonify({"error": "Downloads database not available"}), 503
        
        stats = downloads_db.get_user_stats(username)
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting user download stats: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/downloads/redownloadable', methods=['GET'])
@login_required
def api_get_redownloadable():
    """Get list of books that can be re-downloaded directly"""
    try:
        username = session.get('username')
        if not username:
            return jsonify({"error": "Not authenticated"}), 401
        
        downloads_db = get_downloads_db_manager()
        if not downloads_db:
            return jsonify({"error": "Downloads database not available"}), 503
        
        book_id = request.args.get('book_id')  # Optional filter by book_id
        books = downloads_db.get_redownloadable_books(username, book_id)
        return jsonify({"redownloadable_books": books})
        
    except Exception as e:
        logger.error(f"Error getting redownloadable books: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/downloads/redownload/<int:download_id>', methods=['POST'])
@login_required
def api_redownload_direct(download_id: int):
    """Re-download a book using stored direct URL"""
    try:
        username = session.get('username')
        if not username:
            return jsonify({"error": "Not authenticated"}), 401
        
        downloads_db = get_downloads_db_manager()
        if not downloads_db:
            return jsonify({"error": "Downloads database not available"}), 503
        
        # Verify user owns this download record (secure version)
        record = downloads_db.get_download_record(download_id, username)
        if not record:
            return jsonify({"error": "Download not found or access denied"}), 404
            
        if not record['final_download_url']:
            return jsonify({"error": "No direct download URL available"}), 400
            
        # Generate target path in ingest directory
        from ..infrastructure.env import INGEST_DIR
        from pathlib import Path
        filename = f"{record['book_title']}.{record['book_format']}" if record['book_format'] else f"{record['book_title']}.epub"
        # Sanitize filename
        filename = "".join(c for c in filename if c.isalnum() or c in (' ', '.', '_', '-')).rstrip()
        target_path = Path(INGEST_DIR) / filename
        
        # Attempt direct re-download
        success = downloads_db.direct_redownload(download_id, target_path)
        
        if success:
            return jsonify({
                "success": True, 
                "message": "Re-download completed successfully",
                "file_path": str(target_path)
            })
        else:
            return jsonify({
                "error": "Re-download failed - URL may be expired",
                "suggestion": "Try downloading from Anna's Archive search instead"
            }), 400
            
    except Exception as e:
        logger.error(f"Direct redownload error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def api_status() -> Union[Response, Tuple[Response, int]]:
    """
    Get current download queue status.

    Returns:
        flask.Response: JSON object with queue status.
    """
    try:
        status = backend.queue_status()
        return jsonify(status)
    except Exception as e:
        logger.error_trace(f"Status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/localdownload', methods=['GET'])
@login_required
def api_local_download() -> Union[Response, Tuple[Response, int]]:
    """
    Download an EPUB file from local storage if available.

    Query Parameters:
        id (str): Book identifier (MD5 hash)

    Returns:
        flask.Response: The EPUB file if found, otherwise an error response.
    """
    book_id = request.args.get('id', '')
    if not book_id:
        return jsonify({"error": "No book ID provided"}), 400

    try:
        file_data, book_info = backend.get_book_data(book_id)
        if file_data is None:
            # Book data not found or not available
            return jsonify({"error": "File not found"}), 404
        # Santize the file name
        file_name = book_info.title
        file_name = re.sub(r'[\\/:*?"<>|]', '_', file_name.strip())[:245]
        file_extension = book_info.format
        # Prepare the file for sending to the client
        data = io.BytesIO(file_data)
        return send_file(
            data,
            download_name=f"{file_name}.{file_extension}",
            as_attachment=True
        )

    except Exception as e:
        logger.error_trace(f"Local download error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/download/<book_id>/cancel', methods=['DELETE'])
@login_required
def api_cancel_download(book_id: str) -> Union[Response, Tuple[Response, int]]:
    """
    Cancel a download.

    Path Parameters:
        book_id (str): Book identifier to cancel

    Returns:
        flask.Response: JSON status indicating success or failure.
    """
    try:
        success = backend.cancel_download(book_id)
        if success:
            return jsonify({"status": "cancelled", "book_id": book_id})
        return jsonify({"error": "Failed to cancel download or book not found"}), 404
    except Exception as e:
        logger.error_trace(f"Cancel download error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/queue/<book_id>/priority', methods=['PUT'])
@login_required
def api_set_priority(book_id: str) -> Union[Response, Tuple[Response, int]]:
    """
    Set priority for a queued book.

    Path Parameters:
        book_id (str): Book identifier

    Request Body:
        priority (int): New priority level (lower number = higher priority)

    Returns:
        flask.Response: JSON status indicating success or failure.
    """
    try:
        data = request.get_json()
        if not data or 'priority' not in data:
            return jsonify({"error": "Priority not provided"}), 400
            
        priority = int(data['priority'])
        success = backend.set_book_priority(book_id, priority)
        
        if success:
            return jsonify({"status": "updated", "book_id": book_id, "priority": priority})
        return jsonify({"error": "Failed to update priority or book not found"}), 404
    except ValueError:
        return jsonify({"error": "Invalid priority value"}), 400
    except Exception as e:
        logger.error_trace(f"Set priority error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/queue/reorder', methods=['POST'])
@login_required
def api_reorder_queue() -> Union[Response, Tuple[Response, int]]:
    """
    Bulk reorder queue by setting new priorities.

    Request Body:
        book_priorities (dict): Mapping of book_id to new priority

    Returns:
        flask.Response: JSON status indicating success or failure.
    """
    try:
        data = request.get_json()
        if not data or 'book_priorities' not in data:
            return jsonify({"error": "book_priorities not provided"}), 400
            
        book_priorities = data['book_priorities']
        if not isinstance(book_priorities, dict):
            return jsonify({"error": "book_priorities must be a dictionary"}), 400
            
        # Validate all priorities are integers
        for book_id, priority in book_priorities.items():
            if not isinstance(priority, int):
                return jsonify({"error": f"Invalid priority for book {book_id}"}), 400
                
        success = backend.reorder_queue(book_priorities)
        
        if success:
            return jsonify({"status": "reordered", "updated_count": len(book_priorities)})
        return jsonify({"error": "Failed to reorder queue"}), 500
    except Exception as e:
        logger.error_trace(f"Reorder queue error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/queue/order', methods=['GET'])
@login_required
def api_queue_order() -> Union[Response, Tuple[Response, int]]:
    """
    Get current queue order for display.

    Returns:
        flask.Response: JSON array of queued books with their order and priorities.
    """
    try:
        queue_order = backend.get_queue_order()
        return jsonify({"queue": queue_order})
    except Exception as e:
        logger.error_trace(f"Queue order error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/downloads/active', methods=['GET'])
@login_required
def api_active_downloads() -> Union[Response, Tuple[Response, int]]:
    """
    Get list of currently active downloads.

    Returns:
        flask.Response: JSON array of active download book IDs.
    """
    try:
        active_downloads = backend.get_active_downloads()
        return jsonify({"active_downloads": active_downloads})
    except Exception as e:
        logger.error_trace(f"Active downloads error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/queue/clear', methods=['DELETE'])
@login_required
def api_clear_completed() -> Union[Response, Tuple[Response, int]]:
    """
    Clear all completed, errored, or cancelled books from tracking.

    Returns:
        flask.Response: JSON with count of removed books.
    """
    try:
        removed_count = backend.clear_completed()
        return jsonify({"status": "cleared", "removed_count": removed_count})
    except Exception as e:
        logger.error_trace(f"Clear completed error: {e}")
        return jsonify({"error": str(e)}), 500

# Calibre check endpoints removed - using CWA proxy instead

@app.errorhandler(404)
def not_found_error(error: Exception) -> Union[Response, Tuple[Response, int]]:
    """
    Handle 404 (Not Found) errors.

    Args:
        error (HTTPException): The 404 error raised by Flask.

    Returns:
        flask.Response: JSON error message with 404 status.
    """
    logger.warning(f"404 error: {request.url} : {error}")
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error: Exception) -> Union[Response, Tuple[Response, int]]:
    """
    Handle 500 (Internal Server) errors.

    Args:
        error (HTTPException): The 500 error raised by Flask.

    Returns:
        flask.Response: JSON error message with 500 status.
    """
    logger.error_trace(f"500 error: {error}")
    return jsonify({"error": "Internal server error"}), 500

def validate_credentials(username: str, password: str) -> bool:
    """
    Helper function that validates credentials
    against a Calibre-Web app.db SQLite database

    Database structure:
    - Table 'user' with columns: 'name' (username), 'password'
    """

    # If the database doesn't exist, allow any credentials
    if not CWA_DB_PATH:
        return True

    # Look for app.db in the same directory as cwa.db for authentication
    try:
        # First, try to find app.db in the same directory as cwa.db
        cwa_dir = CWA_DB_PATH.parent
        app_db_path = cwa_dir / "app.db"
        
        if app_db_path.exists():
            # Use app.db for authentication
            db_path = os.fspath(app_db_path)
            logger.info(f"Using app.db for authentication: {app_db_path}")
        else:
            # Fall back to cwa.db and check if it has user table
            db_path = os.fspath(CWA_DB_PATH)
            logger.info(f"No app.db found, checking cwa.db for user table: {CWA_DB_PATH}")
        
        # Open database in true read-only mode to avoid journal/WAL writes on RO mounts
        db_uri = f"file:{db_path}?mode=ro&immutable=1"
        conn = sqlite3.connect(db_uri, uri=True)
        cur = conn.cursor()
        
        # Check if user table exists first
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user'")
        if not cur.fetchone():
            # No user table exists, so no authentication required
            conn.close()
            logger.info("No user table found - authentication bypassed")
            return True
        
        cur.execute("SELECT password FROM user WHERE name = ?", (username,))
        row = cur.fetchone()
        conn.close()

        # Check if user exists and password is correct
        if not row or not row[0] or not check_password_hash(row[0], password):
            logger.error("User not found or password check failed")
            return False

    except Exception as e:
        logger.error_trace(f"Authentication error: {e}")
        return False

    logger.info(f"Authentication successful for user {username}")
    return True

# Register all routes with /request prefix
register_dual_routes(app)

# ============================================================================
# Metadata Database API Endpoints (Direct Access)
# ============================================================================

@app.route('/api/metadata/books', methods=['GET'])
def api_metadata_books():
    """Get books from metadata.db with pagination and filtering"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
            
        # Get query parameters - support both page/per_page and offset/limit styles
        if 'offset' in request.args:
            # Frontend is using offset/limit style
            offset = int(request.args.get('offset', 0))
            per_page = min(int(request.args.get('limit', 20)), 100)
            page = (offset // per_page) + 1
        else:
            # Using page/per_page style
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
        search = request.args.get('search', '').strip()
        sort_by = request.args.get('sort', 'timestamp')
        sort_order = request.args.get('order', 'desc')
        
        # Get books with pagination
        result = db_manager.get_books(
            page=page,
            per_page=per_page,
            search=search,
            sort=sort_by
        )
        
        # Enrich with read status if user is authenticated
        username = session.get('username')
        if username:
            result['books'] = enrich_books_with_read_status(result['books'], username)
        
        return jsonify({
            'books': result['books'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching metadata books: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/books/<int:book_id>')
def api_metadata_book_details(book_id):
    """Get detailed book information from metadata.db"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
            
        book = db_manager.get_book_details(book_id)
        if not book:
            return jsonify({'error': 'Book not found'}), 404
        
        # Enrich with read status if user is authenticated
        username = session.get('username')
        if username:
            enriched_books = enrich_books_with_read_status([book], username)
            book = enriched_books[0] if enriched_books else book
            
        return jsonify(book)
        
    except Exception as e:
        logger.error(f"Error fetching metadata book details: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/books/<int:book_id>/cover')
def api_metadata_book_cover(book_id):
    """Get book cover from metadata.db"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
            
        cover_data = db_manager.get_book_cover(book_id)
        if not cover_data:
            return jsonify({'error': 'Cover not found'}), 404
            
        return send_file(
            io.BytesIO(cover_data),
            mimetype='image/jpeg',
            as_attachment=False
        )
        
    except Exception as e:
        logger.error(f"Error fetching metadata book cover: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/stats')
def api_metadata_stats():
    """Get library statistics from metadata.db"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
            
        stats = db_manager.get_library_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error fetching metadata stats: {e}")
        return jsonify({'error': str(e)}), 500

# Old hot books endpoint removed - replaced with CWA user database implementation below

@app.route('/api/metadata/new-books')
def api_metadata_new_books():
    """Get recently added books (equivalent to OPDS /new)"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Get new books sorted by timestamp desc
        result = db_manager.get_books(page=page, per_page=per_page, sort='new')
        
        return jsonify({
            'books': result['books'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching new books: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/discover-books')
def api_metadata_discover_books():
    """Get random books for discovery (equivalent to OPDS /discover)"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get per_page parameter (no pagination for random books)
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Get random books
        result = db_manager.get_random_books(limit=per_page)
        
        return jsonify({
            'books': result['books'],
            'total': result['total'],
            'page': 1,
            'per_page': per_page,
            'pages': 1
        })
        
    except Exception as e:
        logger.error(f"Error fetching random books: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/rated-books')
def api_metadata_rated_books():
    """Get best rated books (equivalent to OPDS /rated)"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Get highly rated books (rating > 4.5 stars, which is 9/10 in Calibre)
        result = db_manager.get_rated_books(page=page, per_page=per_page)
        
        return jsonify({
            'books': result['books'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching rated books: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/authors')
def api_metadata_authors_list():
    """Get list of all authors (equivalent to OPDS /author)"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 200)
        search = request.args.get('search', '').strip()
        
        # Get authors list with book counts
        result = db_manager.get_authors_with_counts(page=page, per_page=per_page, search=search)
        
        return jsonify({
            'authors': result['authors'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching authors: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/authors/<int:author_id>/books')
def api_metadata_author_books(author_id):
    """Get books by specific author"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Get books by author
        result = db_manager.get_books_by_author(author_id, page=page, per_page=per_page)
        
        return jsonify({
            'books': result['books'],
            'author': result['author'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching books by author: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/series')
def api_metadata_series_list():
    """Get list of all series (equivalent to OPDS /series)"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 200)
        search = request.args.get('search', '').strip()
        starts_with = request.args.get('starts_with', '').strip()
        
        # Get series list with book counts
        result = db_manager.get_series_with_counts(page=page, per_page=per_page, search=search, starts_with=starts_with)
        
        return jsonify({
            'series': result['series'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching series: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/series/<int:series_id>/books')
def api_metadata_series_books(series_id):
    """Get books in specific series"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Get books in series
        result = db_manager.get_books_in_series(series_id, page=page, per_page=per_page)
        
        return jsonify({
            'books': result['books'],
            'series': result['series'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching books in series: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/tags')
def api_metadata_tags_list():
    """Get list of all tags/categories (equivalent to OPDS /category)"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 200)
        search = request.args.get('search', '').strip()
        
        # Get tags list with book counts
        result = db_manager.get_tags_with_counts(page=page, per_page=per_page, search=search)
        
        return jsonify({
            'tags': result['tags'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching tags: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata/tags/<int:tag_id>/books')
def api_metadata_tag_books(tag_id):
    """Get books with specific tag"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Get books with tag
        result = db_manager.get_books_by_tag(tag_id, page=page, per_page=per_page)
        
        return jsonify({
            'books': result['books'],
            'tag': result['tag'],
            'total': result['total'],
            'page': result['page'],
            'per_page': result['per_page'],
            'pages': result['pages']
        })
        
    except Exception as e:
        logger.error(f"Error fetching books by tag: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Admin API Endpoints (Direct Database Management)
# ============================================================================

@app.route('/api/admin/status')
@login_required
def api_admin_status():
    """Check if current user has admin privileges"""
    try:
        is_admin = False
        
        # Method 1: Try CWA client-based admin check
        client = get_cwa_client()
        if client:
            try:
                # Check admin status via CWA
                admin_url = '/admin/view'
                logger.info(f"Admin status check: Testing {client.base_url}{admin_url}")
                response = client.get(admin_url)
                logger.info(f"Admin status check: Response status = {response.status_code}")
                is_admin = response.status_code == 200
            except Exception as e:
                logger.error(f"CWA client admin check failed: {e}")
                is_admin = False
        else:
            logger.error("Admin status check: CWA client not available")
        
        # Method 2: Fallback to database-based admin check if client method failed
        if not is_admin:
            try:
                username = session.get('username')
                if username:
                    from ..infrastructure.cwa_db_manager import get_cwa_db_manager
                    cwa_db = get_cwa_db_manager()
                    if cwa_db:
                        logger.info(f"Admin status check: Trying database fallback for {username}")
                        user_permissions = cwa_db.get_user_permissions(username)
                        is_admin = user_permissions.get('admin', False)
                        logger.info(f"Admin status check: Database result = {is_admin}")
                    else:
                        logger.warning("Admin status check: CWA database not available for fallback")
            except Exception as e:
                logger.error(f"Database admin check failed: {e}")
                is_admin = False
        
        return jsonify({'is_admin': is_admin})
        
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        logger.error(f"Admin status check exception type: {type(e).__name__}")
        return jsonify({'is_admin': False})

@app.route('/api/admin/rate-limiter/status')
@login_required
def api_rate_limiter_status():
    """Get rate limiter statistics (admin only)"""
    try:
        # Get rate limiter stats
        stats = get_rate_limiter_stats()
        
        return jsonify({
            'rate_limiter': stats,
            'message': 'Rate limiter statistics retrieved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error getting rate limiter status: {e}")
        return jsonify({'error': str(e)}), 500

# Direct CWA Database User Management
@app.route('/api/useradmin/users', methods=['GET'])
@login_required
def api_get_users() -> Union[Response, Tuple[Response, int]]:
    """Get all CWA users via direct database access"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        users = cwa_db.get_all_users()
        return jsonify({
            'users': users,
            'total': len(users)
        })
        
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/useradmin/users/<int:user_id>', methods=['GET'])
@login_required
def api_get_user_details(user_id: int) -> Union[Response, Tuple[Response, int]]:
    """Get detailed information for a specific user"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        user = cwa_db.get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify(user)
        
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/useradmin/users', methods=['POST'])
@login_required
def api_create_user() -> Union[Response, Tuple[Response, int]]:
    """Create a new CWA user"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate required fields
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        
        if not username:
            return jsonify({"error": "Username is required"}), 400
        if not email:
            return jsonify({"error": "Email is required"}), 400
        if not password:
            return jsonify({"error": "Password is required"}), 400
        
        # Check if user already exists
        if cwa_db.user_exists(username):
            return jsonify({"error": "User already exists"}), 400
        
        # Create user
        success = cwa_db.create_user(
            username=username,
            email=email,
            password=password,
            kindle_email=data.get('kindle_email', ''),
            locale=data.get('locale', 'en'),
            default_language=data.get('default_language', 'en'),
            permissions=data.get('permissions', {})
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": "User created successfully"
            })
        else:
            return jsonify({"error": "Failed to create user"}), 500
            
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/useradmin/users/<int:user_id>', methods=['PUT'])
@login_required
def api_update_user(user_id: int) -> Union[Response, Tuple[Response, int]]:
    """Update user permissions and details"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Update user
        success = cwa_db.update_user(
            user_id=user_id,
            username=data.get('username'),
            email=data.get('email'),
            kindle_email=data.get('kindle_email'),
            locale=data.get('locale'),
            default_language=data.get('default_language'),
            permissions=data.get('permissions')
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": "User updated successfully"
            })
        else:
            return jsonify({"error": "Failed to update user or user not found"}), 404
            
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/useradmin/users/<int:user_id>', methods=['DELETE'])
@login_required
def api_delete_user(user_id: int) -> Union[Response, Tuple[Response, int]]:
    """Delete a CWA user"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        success = cwa_db.delete_user(user_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": "User deleted successfully"
            })
        else:
            return jsonify({"error": "Failed to delete user or user not found"}), 404
            
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        return jsonify({"error": str(e)}), 500

# User Profile Management (for current user only)
@app.route('/api/profile', methods=['GET'])
@login_required
def api_get_current_user_profile() -> Union[Response, Tuple[Response, int]]:
    """Get current user's profile information"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        username = session.get('username')
        if not username:
            return jsonify({"error": "User not authenticated"}), 401
        
        # Get user by username
        with cwa_db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, email, kindle_mail, locale, default_language, role
                FROM user WHERE name = ? AND name != 'Guest'
            """, (username,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({"error": "User not found"}), 404
            
            user_data = {
                'id': row['id'],
                'username': row['name'],
                'email': row['email'],
                'kindle_email': row['kindle_mail'] or '',
                'locale': row['locale'] or 'en',
                'default_language': row['default_language'] or 'en',
                'permissions': cwa_db._role_to_permissions(row['role'])
            }
            
            return jsonify(user_data)
            
    except Exception as e:
        logger.error(f"Error fetching profile for user {username}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/profile', methods=['PUT'])
@login_required
def api_update_current_user_profile() -> Union[Response, Tuple[Response, int]]:
    """Update current user's profile (limited fields, no permissions)"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        username = session.get('username')
        if not username:
            return jsonify({"error": "User not authenticated"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Get current user ID
        with cwa_db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM user WHERE name = ? AND name != 'Guest'", (username,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({"error": "User not found"}), 404
            
            user_id = row['id']
        
        # Only allow updating specific fields (not permissions)
        allowed_fields = {
            'email': data.get('email'),
            'kindle_email': data.get('kindle_email'),
            'default_language': data.get('default_language')
        }
        
        # Filter out None values
        update_data = {k: v for k, v in allowed_fields.items() if v is not None}
        
        if not update_data:
            return jsonify({"error": "No valid fields to update"}), 400
        
        # Update user profile (without permissions)
        success = cwa_db.update_user(
            user_id=user_id,
            email=update_data.get('email'),
            kindle_email=update_data.get('kindle_email'),
            default_language=update_data.get('default_language')
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": "Profile updated successfully"
            })
        else:
            return jsonify({"error": "Failed to update profile"}), 500
            
    except Exception as e:
        logger.error(f"Error updating profile for user {username}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/profile/password', methods=['PUT'])
@login_required  
def api_change_password() -> Union[Response, Tuple[Response, int]]:
    """Change current user's password"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        from werkzeug.security import generate_password_hash, check_password_hash
        
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        username = session.get('username')
        if not username:
            return jsonify({"error": "User not authenticated"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({"error": "Both current and new passwords are required"}), 400
        
        if len(new_password) < 4:
            return jsonify({"error": "New password must be at least 4 characters long"}), 400
        
        # Get current user and verify current password
        with cwa_db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, password FROM user WHERE name = ? AND name != 'Guest'
            """, (username,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({"error": "User not found"}), 404
            
            # Verify current password
            if not check_password_hash(row['password'], current_password):
                return jsonify({"error": "Current password is incorrect"}), 400
            
            # Update password
            new_password_hash = generate_password_hash(new_password)
            cursor.execute("""
                UPDATE user SET password = ? WHERE id = ?
            """, (new_password_hash, row['id']))
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": "Password changed successfully"
            })
            
    except Exception as e:
        logger.error(f"Error changing password for user {username}: {e}")
        return jsonify({"error": str(e)}), 500

# Download Tracking APIs
@app.route('/api/admin/downloads', methods=['GET'])
@login_required
def api_get_download_history() -> Union[Response, Tuple[Response, int]]:
    """Get download history from CWA database (admin only)"""
    try:
        # Check if user is admin
        username = session.get('username')
        if not username:
            return jsonify({"error": "User not authenticated"}), 401
            
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        # Check if user is admin
        user_permissions = cwa_db.get_user_permissions(username)
        if not user_permissions.get('admin', False):
            return jsonify({"error": "Admin access required"}), 403
        
        # Get query parameters
        target_username = request.args.get('username')
        limit = min(int(request.args.get('limit', 100)), 500)  # Max 500 records
        
        downloads = cwa_db.get_user_downloads(target_username, limit)
        
        return jsonify({
            'downloads': downloads,
            'total_returned': len(downloads)
        })
        
    except Exception as e:
        logger.error(f"Error fetching download history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/download-stats', methods=['GET'])
@login_required
def api_get_download_stats() -> Union[Response, Tuple[Response, int]]:
    """Get download statistics (admin only)"""
    try:
        # Check if user is admin
        username = session.get('username')
        if not username:
            return jsonify({"error": "User not authenticated"}), 401
            
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        # Check if user is admin
        user_permissions = cwa_db.get_user_permissions(username)
        if not user_permissions.get('admin', False):
            return jsonify({"error": "Admin access required"}), 403
        
        stats = cwa_db.get_download_stats()
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error fetching download stats: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/profile/downloads', methods=['GET'])
@login_required
def api_get_my_downloads() -> Union[Response, Tuple[Response, int]]:
    """Get current user's download history"""
    try:
        username = session.get('username')
        if not username:
            return jsonify({"error": "User not authenticated"}), 401
            
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        # Get query parameters
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100 for personal downloads
        
        downloads = cwa_db.get_user_downloads(username, limit)
        
        return jsonify({
            'downloads': downloads,
            'total_returned': len(downloads)
        })
        
    except Exception as e:
        logger.error(f"Error fetching user downloads for {username}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/metadata/hot-books', methods=['GET'])
@login_required
def api_get_hot_books() -> Union[Response, Tuple[Response, int]]:
    """Get hot books based on actual download statistics"""
    try:
        from ..infrastructure.cwa_db_manager import get_cwa_db_manager
        cwa_db = get_cwa_db_manager()
        if not cwa_db:
            return jsonify({"error": "CWA database not available"}), 503
        
        # Get query parameters
        limit = min(int(request.args.get('per_page', 50)), 100)  # Max 100 books
        
        # Get hot books from download statistics
        hot_books_data = cwa_db.get_hot_books(limit)
        
        if not hot_books_data:
            # Return empty result if no download data
            return jsonify({
                'books': [],
                'total': 0,
                'page': 1,
                'per_page': limit,
                'total_pages': 0
            })
        
        # Get book metadata for each hot book
        enriched_books = []
        
        for book_data in hot_books_data:
            book_id = book_data['book_id']
            download_count = book_data['download_count']
            
            try:
                # Fetch book metadata from the direct metadata API
                metadata_response = requests.get(
                    f'http://localhost:8084/api/metadata/books/{book_id}',
                    headers={'User-Agent': 'Inkdrop-HotBooks/1.0'},
                    timeout=5
                )
                
                if metadata_response.status_code == 200:
                    book_metadata = metadata_response.json()
                    
                    # Enrich with download count
                    book_metadata['download_count'] = download_count
                    book_metadata['popularity_rank'] = len(enriched_books) + 1
                    
                    enriched_books.append(book_metadata)
                else:
                    logger.warning(f"Failed to get metadata for book {book_id}: {metadata_response.status_code}")
                    
            except Exception as e:
                logger.warning(f"Error fetching metadata for book {book_id}: {e}")
                continue
        
        logger.info(f"Successfully enriched {len(enriched_books)} hot books with metadata")
        
        return jsonify({
            'books': enriched_books,
            'total': len(enriched_books),
            'page': 1,
            'per_page': limit,
            'total_pages': 1
        })
        
    except Exception as e:
        logger.error(f"Error fetching hot books: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/user-info')
def api_admin_user_info():
    """Get current user info and admin status - simple version for auth checking"""
    try:
        # Check if user is logged in
        if not session.get('logged_in') or not session.get('username'):
            return jsonify({
                'authenticated': False,
                'is_admin': False
            }), 401
        
        username = session.get('username')
        
        # Check actual admin status via CWA
        is_admin = False
        
        # Method 1: Try session-based admin check
        if cwa_proxy:
            try:
                # Get user session
                with cwa_proxy.sessions_lock:
                    user_session = cwa_proxy.user_sessions.get(username)
                
                logger.info(f"Admin check for {username}: user_session exists = {user_session is not None}")
                if user_session:
                    logger.info(f"Admin check: CWA base URL = {user_session.cwa_base_url}")
                    admin_url = f"{user_session.cwa_base_url}/cwa-stats-show"
                    logger.info(f"Admin check: Testing access to {admin_url}")
                    
                    # Test admin access by trying to access admin endpoints
                    response = user_session.session.head(admin_url, timeout=5)
                    logger.info(f"Admin check: Response status = {response.status_code}")
                    is_admin = response.status_code == 200
                else:
                    logger.warning(f"Admin check: No user session found for {username}")
            except Exception as e:
                logger.error(f"Failed session-based admin check for {username}: {e}")
                logger.error(f"Admin check exception type: {type(e).__name__}")
                is_admin = False
        
        # Method 2: Fallback to database-based admin check if session method failed
        if not is_admin:
            try:
                from ..infrastructure.cwa_db_manager import get_cwa_db_manager
                cwa_db = get_cwa_db_manager()
                if cwa_db:
                    logger.info(f"Admin check: Trying database fallback for {username}")
                    user_permissions = cwa_db.get_user_permissions(username)
                    is_admin = user_permissions.get('admin', False)
                    logger.info(f"Admin check: Database result = {is_admin}")
                else:
                    logger.warning("Admin check: CWA database not available for fallback")
            except Exception as e:
                logger.error(f"Failed database-based admin check for {username}: {e}")
                is_admin = False
        
        return jsonify({
            'authenticated': True,
            'username': username,
            'is_admin': is_admin
        })
        
    except Exception as e:
        logger.error(f"Error in user info endpoint: {e}")
        return jsonify({
            'authenticated': False,
            'is_admin': False
        }), 500


@app.route('/api/admin/duplicates')
@login_required
def api_admin_duplicates():
    """Find duplicate books in the library"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
            
        duplicates = db_manager.find_duplicates()
        return jsonify({'duplicates': duplicates})
        
    except Exception as e:
        logger.error(f"Error finding duplicates: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/books/<int:book_id>', methods=['DELETE'])
@login_required
def api_admin_delete_book(book_id):
    """Delete a book from the library"""
    try:
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
            
        success, message = db_manager.delete_book(book_id)
        if success:
            return jsonify({'success': True, 'message': message or f'Book {book_id} deleted successfully'})
        else:
            return jsonify({'error': message or 'Failed to delete book'}), 500
            
    except Exception as e:
        logger.error(f"Error deleting book {book_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/books/bulk-delete', methods=['DELETE'])
@admin_required
def api_admin_bulk_delete_books():
    """Delete multiple books from the library"""
    try:
        data = request.get_json()
        book_ids = data.get('book_ids', [])
        
        if not book_ids:
            return jsonify({'error': 'No book IDs provided'}), 400
            
        db_manager = get_calibre_db_manager()
        if not db_manager:
            return jsonify({'error': 'Metadata database not available'}), 503
            
        deleted_count = db_manager.bulk_delete_books(book_ids)
        return jsonify({
            'success': True, 
            'message': f'Successfully deleted {deleted_count} books',
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        logger.error(f"Error bulk deleting books: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Read Status API Endpoints (User Reading Status)
# ============================================================================

@app.route('/api/books/<int:book_id>/read-status', methods=['GET'])
@login_required
def api_get_book_read_status(book_id):
    """Get read status for a specific book for the current user"""
    try:
        rs_manager = get_read_status_manager_instance()
        if not rs_manager:
            return jsonify({'error': 'Read status manager not available'}), 503
        
        # Get current user info from session
        username = session.get('username')
        if not username:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get or create user ID
        user_id = rs_manager.get_or_create_user(username)
        
        # Get read status
        status = rs_manager.get_book_read_status(book_id, user_id)
        
        return jsonify(status)
        
    except Exception as e:
        logger.error(f"Error getting read status for book {book_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/books/<int:book_id>/read-status', methods=['POST'])
@login_required
def api_set_book_read_status(book_id):
    """Set read status for a specific book for the current user"""
    try:
        rs_manager = get_read_status_manager_instance()
        if not rs_manager:
            return jsonify({'error': 'Read status manager not available'}), 503
        
        # Get current user info from session
        username = session.get('username')
        if not username:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Get or create user ID
        user_id = rs_manager.get_or_create_user(username)
        
        # Handle different actions
        action = data.get('action')
        if action == 'toggle':
            status = rs_manager.toggle_book_read_status(book_id, user_id)
        elif action == 'mark_read':
            rs_manager.mark_as_read(book_id, user_id)
            status = rs_manager.get_book_read_status(book_id, user_id)
        elif action == 'mark_unread':
            rs_manager.mark_as_unread(book_id, user_id)
            status = rs_manager.get_book_read_status(book_id, user_id)
        elif action == 'mark_in_progress':
            rs_manager.mark_as_in_progress(book_id, user_id)
            status = rs_manager.get_book_read_status(book_id, user_id)
        elif action == 'mark_want_to_read':
            rs_manager.mark_as_want_to_read(book_id, user_id)
            status = rs_manager.get_book_read_status(book_id, user_id)
        else:
            return jsonify({'error': 'Invalid action. Use: toggle, mark_read, mark_unread, mark_in_progress, mark_want_to_read'}), 400
        
        return jsonify(status)
        
    except Exception as e:
        logger.error(f"Error setting read status for book {book_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/books/read-status', methods=['POST'])
@login_required
def api_get_multiple_books_read_status():
    """Get read status for multiple books for the current user"""
    try:
        rs_manager = get_read_status_manager_instance()
        if not rs_manager:
            return jsonify({'error': 'Read status manager not available'}), 503
        
        # Get current user info from session
        username = session.get('username')
        if not username:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get request data
        data = request.get_json()
        if not data or 'book_ids' not in data:
            return jsonify({'error': 'book_ids array required'}), 400
        
        book_ids = data['book_ids']
        if not isinstance(book_ids, list):
            return jsonify({'error': 'book_ids must be an array'}), 400
        
        # Get or create user ID
        user_id = rs_manager.get_or_create_user(username)
        
        # Get read status for all books
        statuses = rs_manager.get_multiple_books_read_status(book_ids, user_id)
        
        return jsonify({'book_statuses': statuses})
        
    except Exception as e:
        logger.error(f"Error getting multiple books read status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/reading-stats', methods=['GET'])
@login_required
def api_get_user_reading_stats():
    """Get reading statistics for the current user"""
    try:
        rs_manager = get_read_status_manager_instance()
        if not rs_manager:
            return jsonify({'error': 'Read status manager not available'}), 503
        
        # Get current user info from session
        username = session.get('username')
        if not username:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get or create user ID
        user_id = rs_manager.get_or_create_user(username)
        
        # Get reading stats
        stats = rs_manager.get_user_reading_stats(user_id)
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting user reading stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/books/<status>', methods=['GET'])
@login_required
def api_get_user_books_by_status(status):
    """Get books by read status for the current user"""
    try:
        rs_manager = get_read_status_manager_instance()
        if not rs_manager:
            return jsonify({'error': 'Read status manager not available'}), 503
        
        # Get current user info from session
        username = session.get('username')
        if not username:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get or create user ID
        user_id = rs_manager.get_or_create_user(username)
        
        # Get limit and offset from query params
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        if status == 'all':
            # Use efficient pagination for all user books
            book_ids, total_books = rs_manager.get_all_user_books_paginated(user_id, limit, offset)
        else:
            # Map status string to constant
            status_map = {
                'read': rs_manager.STATUS_FINISHED,
                'unread': rs_manager.STATUS_UNREAD,
                'in_progress': rs_manager.STATUS_IN_PROGRESS,
                'want_to_read': rs_manager.STATUS_WANT_TO_READ
            }
            
            if status not in status_map:
                return jsonify({'error': 'Invalid status. Use: read, unread, in_progress, want_to_read, all'}), 400
            
            # Use efficient pagination for single status
            total_books = rs_manager.get_books_count_by_status(user_id, status_map[status])
            book_ids = rs_manager.get_books_by_read_status(user_id, status_map[status], limit, offset)
        
        if not book_ids:
            return jsonify({'books': [], 'status': status, 'total': 0})
        
        # Get full book metadata from Calibre
        calibre_manager = get_calibre_db_manager()
        if not calibre_manager:
            return jsonify({'error': 'Calibre database not available'}), 503
            
        books = []
        for book_id in book_ids:
            try:
                book_data = calibre_manager.get_book_details(book_id)
                if book_data:
                    books.append(book_data)
            except Exception as e:
                logger.warning(f"Could not get book data for ID {book_id}: {e}")
                continue
        
        # Enrich with read status for authenticated users
        if books:
            books = enrich_books_with_read_status(books, username)
        
        return jsonify({'books': books, 'status': status, 'total': total_books})
        
    except Exception as e:
        logger.error(f"Error getting user books by status {status}: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# CWA Settings API Endpoints
# ============================================================================

@app.route('/api/cwa/settings', methods=['GET'])
@login_required
def api_cwa_get_settings():
    """Get current CWA settings"""
    try:
        settings = cwa_settings.get_current_settings()
        return jsonify(settings)
    except Exception as e:
        logger.error(f"Error getting CWA settings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/settings', methods=['POST'])
@login_required
def api_cwa_save_settings():
    """Save CWA settings"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Save settings
        success = cwa_settings.save_settings(data)
        if not success:
            return jsonify({'error': 'Failed to save settings'}), 500
        
        # Update environment variables for runtime
        cwa_settings.update_env_vars(data)
        
        # Reinitialize CWA client with new settings
        global cwa_client
        cwa_client = get_cwa_client()
        
        return jsonify({
            'success': True,
            'message': 'CWA settings saved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error saving CWA settings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/settings/test', methods=['POST'])
@login_required
def api_cwa_test_connection():
    """Test CWA connection with provided settings"""
    try:
        data = request.get_json()
        if not data:
            # Test with current settings
            result = cwa_settings.test_connection()
        else:
            # Test with provided settings
            result = cwa_settings.test_connection(data)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error testing CWA connection: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        })

# ============================================================================
# CWA Integration API Endpoints
# ============================================================================

@app.route('/api/cwa/status')
@login_required
def api_cwa_status():
    """Check CWA instance connection status"""
    try:
        client = get_cwa_client()
        if not client:
            return jsonify({
                'connected': False,
                'base_url': None,
                'authenticated': False,
                'error': 'CWA integration is disabled'
            })
            
        is_connected = client.check_connection()
        return jsonify({
            'connected': is_connected,
            'base_url': client.base_url,
            'authenticated': client.authenticated
        })
    except Exception as e:
        logger.error(f"Error checking CWA status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/books')
@login_required
def api_cwa_books():
    """Get books from CWA library"""
    try:
        client = get_cwa_client()
        if not client:
            return jsonify({'error': 'CWA integration is disabled'}), 503
            
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        sort = request.args.get('sort', 'new')
        
        books = client.get_books(page=page, per_page=per_page, sort=sort)
        if books is None:
            return jsonify({'error': 'Failed to fetch books from CWA'}), 500
            
        return jsonify(books)
    except Exception as e:
        logger.error(f"Error fetching CWA books: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/search')
@login_required
def api_cwa_search():
    """Search books in CWA library"""
    try:
        query = request.args.get('query', '')
        page = request.args.get('page', 1, type=int)
        
        if not query:
            return jsonify({'error': 'Query parameter is required'}), 400
            
        results = cwa_client.search_books(query=query, page=page)
        if results is None:
            return jsonify({'error': 'Failed to search CWA library'}), 500
            
        return jsonify(results)
    except Exception as e:
        logger.error(f"Error searching CWA library: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/book/<int:book_id>')
@login_required
def api_cwa_book_details(book_id):
    """Get detailed information about a CWA book"""
    try:
        book_details = cwa_client.get_book_details(book_id)
        if book_details is None:
            return jsonify({'error': 'Book not found or failed to fetch details'}), 404
            
        return jsonify(book_details)
    except Exception as e:
        logger.error(f"Error fetching CWA book details: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/book/<int:book_id>/formats')
@login_required
def api_cwa_book_formats(book_id):
    """Get available formats for a CWA book"""
    try:
        formats = cwa_client.get_book_formats(book_id)
        if formats is None:
            return jsonify({'error': 'Failed to fetch book formats'}), 500
            
        return jsonify({'formats': formats})
    except Exception as e:
        logger.error(f"Error fetching CWA book formats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/book/<int:book_id>/download/<format>')
@login_required
def api_cwa_download_book(book_id, format):
    """Download a book from CWA in specified format"""
    try:
        book_data = cwa_client.download_book(book_id, format)
        if book_data is None:
            return jsonify({'error': 'Failed to download book'}), 500
            
        # Get book details for filename
        book_details = cwa_client.get_book_details(book_id)
        filename = f"book_{book_id}.{format}"
        if book_details and 'title' in book_details:
            safe_title = "".join(c for c in book_details['title'] if c.isalnum() or c in (' ', '-', '_')).rstrip()
            filename = f"{safe_title}.{format}"
            
        return send_file(
            io.BytesIO(book_data),
            as_attachment=True,
            download_name=filename,
            mimetype=f'application/{format}'
        )
    except Exception as e:
        logger.error(f"Error downloading book from CWA: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/book/<int:book_id>/reader')
@login_required
def api_cwa_reader_url(book_id):
    """Get CWA reader URL for a book"""
    try:
        format = request.args.get('format', 'epub')
        reader_url = cwa_client.get_reader_url(book_id, format)
        
        return jsonify({
            'reader_url': reader_url,
            'book_id': book_id,
            'format': format
        })
    except Exception as e:
        logger.error(f"Error getting CWA reader URL: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/book/<int:book_id>/cover')
@login_required
def api_cwa_book_cover(book_id):
    """Get CWA book cover URL"""
    try:
        cover_url = cwa_client.get_cover_url(book_id)
        
        return jsonify({
            'cover_url': cover_url,
            'book_id': book_id
        })
    except Exception as e:
        logger.error(f"Error getting CWA book cover: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/authors')
@login_required
def api_cwa_authors():
    """Get authors from CWA library"""
    try:
        authors = cwa_client.get_authors()
        if authors is None:
            return jsonify({'error': 'Failed to fetch authors'}), 500
            
        return jsonify({'authors': authors})
    except Exception as e:
        logger.error(f"Error fetching CWA authors: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/series')
@login_required
def api_cwa_series():
    """Get series from CWA library"""
    try:
        series = cwa_client.get_series()
        if series is None:
            return jsonify({'error': 'Failed to fetch series'}), 500
            
        return jsonify({'series': series})
    except Exception as e:
        logger.error(f"Error fetching CWA series: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/categories')
@login_required
def api_cwa_categories():
    """Get categories from CWA library"""
    try:
        categories = cwa_client.get_categories()
        if categories is None:
            return jsonify({'error': 'Failed to fetch categories'}), 500
            
        return jsonify({'categories': categories})
    except Exception as e:
        logger.error(f"Error fetching CWA categories: {e}")
        return jsonify({'error': str(e)}), 500

# Library-specific endpoints (for books already in CWA library)
@app.route('/api/cwa/library/books/<int:book_id>/download/<format>')
@login_required
def api_cwa_library_download_book(book_id, format):
    """Download book from CWA library"""
    try:
        client = get_cwa_client()
        if not client:
            return jsonify({'error': 'CWA not configured'}), 400
        
        # Proxy the download request to CWA
        response = client.get_raw(f'/download/{book_id}/{format}')
        
        if response.status_code == 200:
            return send_file(
                io.BytesIO(response.content),
                mimetype='application/octet-stream',
                as_attachment=True,
                download_name=f'book_{book_id}.{format.lower()}'
            )
        else:
            return jsonify({'error': 'Failed to download book from CWA'}), response.status_code
            
    except Exception as e:
        logger.error(f"Error downloading book from CWA library: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cwa/library/books/<int:book_id>/send-to-kindle', methods=['POST'])
@login_required  
def api_cwa_library_send_to_kindle(book_id):
    """Send book from CWA library to Kindle - redirect to CWA proxy route"""
    try:
        if not cwa_proxy:
            return jsonify({'error': 'CWA proxy not available'}), 503
            
        data = request.get_json() or {}
        format_type = data.get('format', 'EPUB').upper()
        convert = 0  # No conversion needed for EPUB
        
        # Make internal request to the CWA proxy route
        from flask import url_for
        import requests
        
        # Build the internal URL for the CWA proxy send endpoint
        internal_url = f"http://localhost:{FLASK_PORT}/api/cwa/library/books/{book_id}/send/{format_type}/{convert}"
        
        # Forward the request with the same session cookies
        response = requests.post(
            internal_url,
            cookies=request.cookies,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            result_data = response.json()
            # Convert CWA response format to our expected format
            if isinstance(result_data, list) and len(result_data) > 0:
                first_result = result_data[0]
                if first_result.get('type') == 'success':
                    return jsonify({
                        'success': True, 
                        'message': first_result.get('message', 'Book sent to Kindle successfully')
                    })
                else:
                    return jsonify({
                        'error': first_result.get('message', 'Failed to send book to Kindle')
                    }), 400
            else:
                return jsonify({'error': 'Unexpected response format from CWA'}), 500
        else:
            # Forward the error response
            try:
                error_data = response.json()
                return jsonify(error_data), response.status_code
            except:
                return jsonify({'error': f'CWA request failed: {response.status_code}'}), response.status_code
            
    except Exception as e:
        logger.error(f"Error sending book to Kindle: {e}")
        return jsonify({'error': f'Failed to send book to Kindle: {str(e)}'}), 500

@app.route('/api/ingest/upload', methods=['POST'])
@login_required
def api_ingest_upload():
    """Upload book files to the ingest directory with history tracking."""
    import uuid
    
    try:
        if 'books' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('books')
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        # Get current user
        username = session.get('username', 'anonymous')
        
        # Generate session ID for this batch upload
        session_id = str(uuid.uuid4())
        
        # Get uploads database manager
        uploads_db = get_uploads_db_manager()
        if not uploads_db:
            logger.error("Uploads database not available")
        
        # Use the configured ingest directory from environment
        ingest_dir = str(INGEST_DIR)
        logger.info(f"Using ingest directory: {ingest_dir}")
        
        # Create ingest directory if it doesn't exist
        os.makedirs(ingest_dir, exist_ok=True)
        
        uploaded_files = []
        errors = []
        upload_records = []
        
        for file in files:
            if file.filename == '':
                continue
            
            # Create upload record first
            upload_id = None
            if uploads_db:
                try:
                    # Get file info
                    file.seek(0, 2)  # Seek to end
                    file_size = file.tell()
                    file.seek(0)  # Reset to beginning
                    
                    file_ext = os.path.splitext(file.filename)[1].lower()
                    
                    upload_id = uploads_db.create_upload_record(
                        username=username,
                        filename=file.filename,
                        original_filename=file.filename,
                        file_size=file_size,
                        file_type=file_ext,
                        session_id=session_id
                    )
                    upload_records.append({
                        'id': upload_id,
                        'filename': file.filename,
                        'status': 'uploading'
                    })
                except Exception as e:
                    logger.error(f"Failed to create upload record for {file.filename}: {e}")
            
            # Validate file extension
            allowed_extensions = {'.epub', '.pdf', '.mobi', '.azw', '.azw3'}
            file_ext = os.path.splitext(file.filename)[1].lower()
            
            if file_ext not in allowed_extensions:
                error_msg = f'{file.filename}: Unsupported file type'
                errors.append(error_msg)
                if uploads_db and upload_id:
                    uploads_db.update_upload_status(upload_id, 'failed', error_msg)
                continue
            
            try:
                # Save file to ingest directory
                file_path = os.path.join(ingest_dir, file.filename)
                file.save(file_path)
                uploaded_files.append(file.filename)
                logger.info(f"Uploaded book file to ingest: {file.filename}")
                
                # Update upload record as completed
                if uploads_db and upload_id:
                    uploads_db.update_upload_status(upload_id, 'completed')
                    # Update record status
                    for record in upload_records:
                        if record['id'] == upload_id:
                            record['status'] = 'completed'
                
            except Exception as e:
                error_msg = f'{file.filename}: Failed to save file'
                logger.error(f"Failed to save file {file.filename}: {e}")
                errors.append(error_msg)
                
                # Update upload record as failed
                if uploads_db and upload_id:
                    uploads_db.update_upload_status(upload_id, 'failed', str(e))
                    # Update record status
                    for record in upload_records:
                        if record['id'] == upload_id:
                            record['status'] = 'failed'
        
        if not uploaded_files and errors:
            return jsonify({'error': 'No files were uploaded', 'details': errors}), 400
        
        result = {
            'message': f'Successfully uploaded {len(uploaded_files)} file(s)',
            'uploaded': uploaded_files,
            'session_id': session_id,
            'upload_records': upload_records
        }
        
        if errors:
            result['warnings'] = errors
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in ingest upload: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/uploads/history', methods=['GET'])
@login_required
def api_upload_history():
    """Get upload history for the current user."""
    try:
        username = session.get('username', 'anonymous')
        limit = request.args.get('limit', 50, type=int)
        
        uploads_db = get_uploads_db_manager()
        if not uploads_db:
            return jsonify({'error': 'Uploads database not available'}), 503
        
        uploads = uploads_db.get_user_uploads(username, limit)
        return jsonify({'uploads': uploads})
        
    except Exception as e:
        logger.error(f"Error getting upload history: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/uploads/session/<session_id>', methods=['GET'])
@login_required
def api_upload_session(session_id):
    """Get upload details for a specific session."""
    try:
        uploads_db = get_uploads_db_manager()
        if not uploads_db:
            return jsonify({'error': 'Uploads database not available'}), 503
        
        uploads = uploads_db.get_session_uploads(session_id)
        return jsonify({'uploads': uploads, 'session_id': session_id})
        
    except Exception as e:
        logger.error(f"Error getting session uploads: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/uploads/stats', methods=['GET'])
@login_required
def api_upload_stats():
    """Get upload statistics for the current user."""
    try:
        username = session.get('username', 'anonymous')
        
        uploads_db = get_uploads_db_manager()
        if not uploads_db:
            return jsonify({'error': 'Uploads database not available'}), 503
        
        stats = uploads_db.get_upload_stats(username)
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting upload stats: {e}")
        return jsonify({'error': 'Internal server error'}), 500

logger.log_resource_usage()

if __name__ == '__main__':
    logger.info(f"Starting Flask application on {FLASK_HOST}:{FLASK_PORT} IN {APP_ENV} mode")
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=DEBUG 
    )
