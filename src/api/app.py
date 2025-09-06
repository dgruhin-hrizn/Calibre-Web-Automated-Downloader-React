"""
Inkdrop Book Downloader - Main Flask Application
Modular architecture with separated route handlers
"""

import logging
import os
from flask import Flask, jsonify, render_template, request, session
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from functools import wraps
from datetime import datetime

from ..infrastructure.logger import setup_logger
from ..infrastructure.env import FLASK_HOST, FLASK_PORT, DEBUG, BUILD_VERSION

logger = setup_logger(__name__)

# ============================================================================
# Flask Application Setup
# ============================================================================

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['APPLICATION_ROOT'] = '/'

# Configure Flask sessions
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'inkdrop-secret-key')
app.config['SESSION_COOKIE_NAME'] = 'inkdrop_session'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400

# Configure CORS for development
if DEBUG:
    CORS(app, 
         origins=["http://localhost:5173", "http://localhost:3000"], 
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
# ============================================================================
# Authentication Decorators
# ============================================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.endpoint in ['index', 'catch_all']:
            return f(*args, **kwargs)
            
        disable_auth = os.environ.get('DISABLE_AUTH', 'false').lower()
        if disable_auth == 'true':
            return f(*args, **kwargs)
            
        if not session.get('logged_in') or not session.get('username'):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in') or not session.get('username'):
            return jsonify({"error": "Authentication required"}), 401
        
        username = session.get('username')
        
        try:
            from ..infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            
            if not cwa_db:
                return jsonify({"error": "Admin verification unavailable"}), 503
                
            user_permissions = cwa_db.get_user_permissions(username)
            is_admin = user_permissions.get('admin', False)
            
            if not is_admin:
                return jsonify({"error": "Admin privileges required"}), 403
                
        except Exception as e:
            logger.error(f"Error checking admin status for {username}: {e}")
            return jsonify({"error": "Admin verification failed"}), 403
            
        return f(*args, **kwargs)
    return decorated_function

# Make decorators available globally
app.login_required = login_required
app.admin_required = admin_required

# ============================================================================
# Import Route Modules
# ============================================================================

# Import all route modules to register them with the Flask app
from .routes import auth, downloads, metadata, admin, kindle, read_status, cwa_compat, library, uploads

# Register route modules with the app
auth.register_routes(app)
downloads.register_routes(app)
metadata.register_routes(app)
admin.register_routes(app)
kindle.register_routes(app)
read_status.register_routes(app)
cwa_compat.register_routes(app)
library.register_routes(app)
uploads.register_routes(app)

# ============================================================================
# Basic Routes
# ============================================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<path:path>')
def catch_all(path):
    if path.startswith('api/'):
        return jsonify({"error": "API endpoint not found"}), 404
    return render_template('index.html')

@app.route('/api/health')
def health_check():
        return jsonify({
        'status': 'healthy',
        'version': BUILD_VERSION,
        'timestamp': datetime.now().isoformat(),
        'independent': True
    })

# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    if request.path.startswith('/api/'):
        return jsonify({"error": "API endpoint not found"}), 404
    return render_template('index.html')

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

# ============================================================================
# Application Startup
# ============================================================================

if __name__ == '__main__':
    logger.info(f"Starting Inkdrop Book Downloader v{BUILD_VERSION}")
    logger.info(f"Debug mode: {DEBUG}")
    
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=DEBUG,
        threaded=True
    )
