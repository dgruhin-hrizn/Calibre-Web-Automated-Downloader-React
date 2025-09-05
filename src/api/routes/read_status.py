"""
Read Status Routes Module
Handles reading status tracking endpoints
"""

from flask import request, jsonify, session
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger

logger = setup_logger(__name__)

def get_read_status_manager():
    """Get read status manager instance"""
    from ...integrations.calibre.read_status_manager import get_read_status_manager
    from ...infrastructure.env import CWA_USER_DB_PATH
    try:
        return get_read_status_manager(str(CWA_USER_DB_PATH))
    except Exception as e:
        logger.error(f"Failed to get read status manager: {e}")
        return None

def register_routes(app):
    """Register read status routes with the Flask app"""
    
    @app.route('/api/books/<int:book_id>/read-status', methods=['GET'])
    @app.login_required
    def api_get_read_status(book_id: int):
        """Get reading status for a specific book"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            status = read_status_manager.get_read_status(username, book_id)
            return jsonify(status)
            
        except Exception as e:
            logger.error(f"Error getting read status: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/books/<int:book_id>/read-status', methods=['POST'])
    @app.login_required
    def api_update_read_status(book_id: int):
        """Update reading status for a specific book"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            data = request.get_json()
            if not data:
                return jsonify({"error": "No status data provided"}), 400
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            # Extract status and progress from request
            status = data.get('status', 'unread')
            progress = data.get('progress', 0)
            
            # Validate status
            valid_statuses = ['unread', 'reading', 'completed', 'on-hold']
            if status not in valid_statuses:
                return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400
            
            # Validate progress
            if not isinstance(progress, (int, float)) or progress < 0 or progress > 100:
                return jsonify({"error": "Progress must be a number between 0 and 100"}), 400
            
            # Update status
            success = read_status_manager.update_read_status(username, book_id, status, progress)
            
            if success:
                return jsonify({
                    "success": True,
                    "message": "Read status updated successfully",
                    "book_id": book_id,
                    "status": status,
                    "progress": progress
                })
            else:
                return jsonify({"error": "Failed to update read status"}), 500
                
        except Exception as e:
            logger.error(f"Error updating read status: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/books/<int:book_id>/read-status', methods=['DELETE'])
    @app.login_required
    def api_delete_read_status(book_id: int):
        """Delete/reset reading status for a specific book"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            success = read_status_manager.delete_read_status(username, book_id)
            
            if success:
                return jsonify({
                    "success": True,
                    "message": "Read status reset successfully",
                    "book_id": book_id
                })
            else:
                return jsonify({"error": "Failed to reset read status"}), 500
                
        except Exception as e:
            logger.error(f"Error deleting read status: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/user/reading-stats', methods=['GET'])
    @app.login_required
    def api_get_user_reading_stats():
        """Get reading statistics for the current user"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            stats = read_status_manager.get_user_reading_stats(username)
            return jsonify(stats)
            
        except Exception as e:
            logger.error(f"Error getting reading stats: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/user/reading-list', methods=['GET'])
    @app.login_required
    def api_get_user_reading_list():
        """Get user's reading list with optional status filter"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            # Get query parameters
            status_filter = request.args.get('status')  # Optional filter by status
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            reading_list = read_status_manager.get_user_reading_list(
                username, 
                status_filter=status_filter, 
                page=page, 
                per_page=per_page
            )
            
            return jsonify(reading_list)
            
        except Exception as e:
            logger.error(f"Error getting reading list: {e}")
            return jsonify({"error": str(e)}), 500
