"""Flask web application for book download service with URL rewrite support."""

import logging
import io, re, os
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, render_template, send_file, send_from_directory, session
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash
from werkzeug.wrappers import Response
from flask import url_for as flask_url_for
import typing

from logger import setup_logger
from config import _SUPPORTED_BOOK_LANGUAGE, BOOK_LANGUAGE
from env import FLASK_HOST, FLASK_PORT, APP_ENV, CWA_DB_PATH, DEBUG, USING_EXTERNAL_BYPASSER, BUILD_VERSION, RELEASE_VERSION, CALIBRE_LIBRARY_PATH
import backend

from cwa_client import CWAClient
from cwa_settings import cwa_settings
from cwa_proxy import CWAProxy, create_cwa_proxy_routes, create_opds_routes
from calibre_db_manager import CalibreDBManager

from models import SearchFilters

logger = setup_logger(__name__)
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app)  # type: ignore
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching
app.config['APPLICATION_ROOT'] = '/'

# Configure Flask sessions
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'cwa-downloader-secret-key-change-in-production')
app.config['SESSION_COOKIE_NAME'] = 'cwa_downloader_session'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours

# Enable CORS for React frontend
# In production, CORS isn't needed since frontend is served from same origin
# In development, allow localhost origins for Vite dev server
cors_origins = []
if APP_ENV in ['development', 'dev']:
    cors_origins = ['http://localhost:5173', 'http://127.0.0.1:5173']

CORS(app, 
     origins=cors_origins,
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# Initialize Calibre DB manager for direct database access
calibre_db_manager = None

# Flask logger
app.logger.handlers = logger.handlers
app.logger.setLevel(logger.level)
# Also handle Werkzeug's logger
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.handlers = logger.handlers
werkzeug_logger.setLevel(logger.level)

# Set up session configuration
# The secret key will reset every time we restart, which will
# require users to authenticate again
app.config.update(
    SECRET_KEY = os.urandom(64),
    SESSION_COOKIE_HTTPONLY = True,
    SESSION_COOKIE_SECURE = False,  # Set to True in production with HTTPS
    SESSION_COOKIE_SAMESITE = 'Lax',
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours
)

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

# Initialize with current settings
cwa_client = get_cwa_client()

# Direct CWA database integration removed - using proxy approach instead

# Initialize CWA proxy using settings from env.py
from env import CWA_BASE_URL, CWA_USERNAME, CWA_PASSWORD
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

@app.route('/')
@login_required
def index() -> str:
    """
    Serve React frontend in production, or render template in development.
    """
    # Check if we have a built React app
    react_build_path = os.path.join(app.root_path, 'frontend', 'dist', 'index.html')
    if os.path.exists(react_build_path):
        return send_file(react_build_path)
    
    # Fallback to original template for development
    return render_template('index.html', 
                           book_languages=_SUPPORTED_BOOK_LANGUAGE, 
                           default_language=BOOK_LANGUAGE, 
                           debug=DEBUG,
                           build_version=BUILD_VERSION,
                           release_version=RELEASE_VERSION,
                           app_env=APP_ENV
                           )

# Serve React static files
@app.route('/assets/<path:filename>')
def react_assets(filename):
    """Serve React build assets."""
    return send_from_directory(os.path.join(app.root_path, 'frontend', 'dist', 'assets'), filename)

# Catch-all route for React Router (SPA routing)
@app.route('/<path:path>')
@login_required
def catch_all(path):
    """
    Catch-all route to serve React app for client-side routing.
    This ensures that React Router can handle routes like /search, /downloads, etc.
    """
    # Skip API routes and other backend routes
    if path.startswith(('api/', 'static/', 'assets/', 'request/', 'opds/')):
        return "Not Found", 404
    
    # Check if we have a built React app
    react_build_path = os.path.join(app.root_path, 'frontend', 'dist', 'index.html')
    if os.path.exists(react_build_path):
        return send_file(react_build_path)
    
    # Fallback to 404 if no React build found
    return "Frontend not built", 404

 

@app.route('/favico<path:_>')
@app.route('/request/favico<path:_>')
@app.route('/request/static/favico<path:_>')
def favicon(_ : typing.Any) -> Response:
    return send_from_directory(os.path.join(app.root_path, 'static', 'media'),
        'favicon.ico', mimetype='image/vnd.microsoft.icon')

from typing import Union, Tuple

if DEBUG:
    import subprocess
    import time
    if USING_EXTERNAL_BYPASSER:
        STOP_GUI = lambda: None  # No-op for external bypasser
    else:
        from cloudflare_bypasser import _reset_driver as STOP_GUI
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
            from cwa_proxy import CWAUserSession
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
                return jsonify({
                    "success": True,
                    "user": {"username": username}
                })
            else:
                logger.warning(f"CWA authentication failed for user: {username}")
                return jsonify({"error": "Invalid username or password"}), 401
        else:
            # Fallback to local validation if CWA proxy not available
            logger.warning("CWA proxy not available, falling back to local validation")
            if validate_credentials(username, password):
                session['logged_in'] = True
                session['username'] = username
                session['cwa_password'] = password
                session.permanent = True
                
                logger.info(f"User {username} logged in successfully (local fallback)")
                return jsonify({
                    "success": True,
                    "user": {"username": username}
                })
            else:
                logger.warning(f"Local authentication failed for user: {username}")
                return jsonify({"error": "Invalid username or password"}), 401
            
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
        return jsonify({"success": True})
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

    Returns:
        flask.Response: JSON status object indicating success or failure.
    """
    book_id = request.args.get('id', '')
    if not book_id:
        return jsonify({"error": "No book ID provided"}), 400

    try:
        priority = int(request.args.get('priority', 0))
        success = backend.queue_book(book_id, priority)
        if success:
            return jsonify({"status": "queued", "priority": priority})
        return jsonify({"error": "Failed to queue book"}), 500
    except Exception as e:
        logger.error_trace(f"Download error: {e}")
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
            per_page = min(int(request.args.get('limit', 18)), 100)
            page = (offset // per_page) + 1
        else:
            # Using page/per_page style
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 18)), 100)
            
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

# ============================================================================
# Admin API Endpoints (Direct Database Management)
# ============================================================================

@app.route('/api/admin/status')
@login_required
def api_admin_status():
    """Check if current user has admin privileges"""
    try:
        client = get_cwa_client()
        if not client:
            return jsonify({'error': 'CWA not configured'}), 400
            
        # Check admin status via CWA
        response = client.get('/admin/view')
        is_admin = response.status_code == 200
        
        return jsonify({'is_admin': is_admin})
        
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return jsonify({'is_admin': False})

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
        
        # For now, assume admin if logged in (can be enhanced later)
        # This is just to get the system working again
        return jsonify({
            'authenticated': True,
            'username': username,
            'is_admin': True  # Simplified for now
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
        per_page = request.args.get('per_page', 18, type=int)
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

logger.log_resource_usage()

if __name__ == '__main__':
    logger.info(f"Starting Flask application on {FLASK_HOST}:{FLASK_PORT} IN {APP_ENV} mode")
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=DEBUG 
    )
