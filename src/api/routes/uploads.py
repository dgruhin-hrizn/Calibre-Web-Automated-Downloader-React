"""
Upload Routes Module
Handles file upload history and management endpoints
"""

from flask import request, jsonify, session
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger

logger = setup_logger(__name__)

def get_uploads_db_manager():
    """Get uploads database manager instance"""
    from ...infrastructure.uploads_db import UploadsDBManager
    from ...infrastructure.env import DOWNLOADS_DB_PATH
    try:
        uploads_db_path = DOWNLOADS_DB_PATH.parent / "uploads.db"
        return UploadsDBManager(uploads_db_path)
    except Exception as e:
        logger.error(f"Failed to get uploads database manager: {e}")
        return None

def register_routes(app):
    """Register upload routes with the Flask app"""
    
    @app.route('/api/uploads/history', methods=['GET'])
    @app.login_required
    def api_uploads_history():
        """Get user's upload history"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({'error': 'User not authenticated'}), 401
                
            limit = min(int(request.args.get('limit', 50)), 100)
            
            uploads_db = get_uploads_db_manager()
            if not uploads_db:
                return jsonify({'error': 'Uploads database not available'}), 503
                
            uploads = uploads_db.get_user_uploads(username, limit)
            return jsonify({'uploads': uploads})
            
        except Exception as e:
            logger.error(f"Error fetching upload history: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/uploads/session/<session_id>', methods=['GET'])
    @app.login_required
    def api_uploads_session(session_id):
        """Get uploads for a specific session"""
        try:
            uploads_db = get_uploads_db_manager()
            if not uploads_db:
                return jsonify({'error': 'Uploads database not available'}), 503
                
            uploads = uploads_db.get_session_uploads(session_id)
            return jsonify({'uploads': uploads, 'session_id': session_id})
            
        except Exception as e:
            logger.error(f"Error getting session uploads: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/uploads/stats', methods=['GET'])
    @app.login_required
    def api_uploads_stats():
        """Get upload statistics for current user"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({'error': 'User not authenticated'}), 401
                
            uploads_db = get_uploads_db_manager()
            if not uploads_db:
                return jsonify({'error': 'Uploads database not available'}), 503
                
            stats = uploads_db.get_upload_stats(username)
            return jsonify(stats)
            
        except Exception as e:
            logger.error(f"Error fetching upload stats: {e}")
            return jsonify({'error': str(e)}), 500
