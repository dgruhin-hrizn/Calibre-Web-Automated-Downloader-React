"""
Authentication Routes Module
Handles login, logout, and session management
"""

import os
import sqlite3
from flask import request, jsonify, session
from werkzeug.security import check_password_hash
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger
from ...infrastructure.env import CWA_DB_PATH

logger = setup_logger(__name__)

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
        logger.error(f"Authentication error: {e}")
        return False

    logger.info(f"Authentication successful for user {username}")
    return True

def register_routes(app):
    """Register authentication routes with the Flask app"""
    
    @app.route('/api/login', methods=['POST'])
    def api_login() -> Union[Response, Tuple[Response, int]]:
        """
        Login endpoint that authenticates with direct database access.
        
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
            
            # Authenticate directly against app.db database
            logger.info(f"Attempting direct database authentication for user: {username}")
            
            if validate_credentials(username, password):
                # Authentication successful - create local session
                session['logged_in'] = True
                session['username'] = username
                session.permanent = True
                
                logger.info(f"User {username} logged in successfully via direct database authentication")
                
                # Create the response
                response = jsonify({
                    "success": True,
                    "user": {"username": username}
                })
                
                return response
            else:
                logger.warning(f"Direct database authentication failed for user: {username}")
                return jsonify({"error": "Invalid username or password"}), 401
                
        except Exception as e:
            logger.error(f"Login error: {e}")
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
            
            logger.debug(f"Logging out user: {username}")
            
            session.clear()
            logger.info(f"User {username} logged out")
            
            # Create response - Flask handles session cookie clearing automatically
            response = jsonify({"success": True})
            
            return response
        except Exception as e:
            logger.error(f"Logout error: {e}")
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
            logger.error(f"Auth check error: {e}")
            return jsonify({"authenticated": False}), 401

    @app.route('/api/debug/session', methods=['GET'])
    @app.login_required
    def debug_session() -> Union[Response, Tuple[Response, int]]:
        """
        Debug endpoint to check session state.
        """
        try:
            session_data = {
                "logged_in": session.get('logged_in'),
                "username": session.get('username'),
                "session_keys": list(session.keys())
            }
            return jsonify(session_data)
        except Exception as e:
            logger.error(f"Session debug error: {e}")
            return jsonify({"error": "Session debug failed"}), 500
