"""
Kindle Routes Module
Handles Send to Kindle functionality
"""

from flask import request, jsonify, session
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger
from ...core.kindle_sender import get_kindle_sender

logger = setup_logger(__name__)

def get_downloads_db_manager():
    """Get downloads database manager instance"""
    from ...infrastructure.downloads_db import DownloadsDBManager
    from ...infrastructure.env import DOWNLOADS_DB_PATH
    try:
        return DownloadsDBManager(DOWNLOADS_DB_PATH)
    except Exception as e:
        logger.error(f"Failed to get downloads database manager: {e}")
        return None

def get_calibre_db_manager():
    """Get Calibre database manager instance"""
    from ...integrations.calibre.db_manager import CalibreDBManager
    from ...infrastructure.env import CALIBRE_LIBRARY_PATH
    try:
        metadata_db_path = CALIBRE_LIBRARY_PATH / 'metadata.db'
        return CalibreDBManager(str(metadata_db_path))
    except Exception as e:
        logger.error(f"Failed to get Calibre database manager: {e}")
        return None

def register_routes(app):
    """Register Kindle routes with the Flask app"""
    
    @app.route('/api/kindle/send/<book_id>', methods=['POST'])
    @app.login_required
    def api_send_to_kindle(book_id: str):
        """Send a downloaded book to Kindle"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            kindle_sender = get_kindle_sender()
            if not kindle_sender:
                return jsonify({"error": "Kindle sender not available"}), 503
            
            # Get user's Kindle email
            user_kindle_email = kindle_sender.get_user_kindle_email(username)
            if not user_kindle_email:
                return jsonify({"error": "No Kindle email configured for user"}), 400
            
            # Get book from downloads database
            downloads_db = get_downloads_db_manager()
            if not downloads_db:
                return jsonify({"error": "Downloads database not available"}), 503
            
            # Find the book in user's download history
            downloads = downloads_db.get_user_downloads(username, status='completed', limit=1000, offset=0)
            book_record = None
            for download in downloads:
                if download['book_id'] == book_id:
                    book_record = download
                    break
            
            if not book_record:
                return jsonify({"error": "Book not found in download history"}), 404
            
            # Send to Kindle
            success = kindle_sender.send_book_to_kindle(
                book_id=book_id,
                book_title=book_record['book_title'],
                book_author=book_record['book_author'],
                recipient_email=user_kindle_email
            )
            
            if success:
                return jsonify({
                    "success": True,
                    "message": f"Book sent to {user_kindle_email} successfully"
                })
            else:
                return jsonify({"error": "Failed to send book to Kindle"}), 500
                
        except Exception as e:
            logger.error(f"Send to Kindle error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/kindle/send/library/<int:book_id>', methods=['POST'])
    @app.login_required
    def api_send_library_book_to_kindle(book_id: int):
        """Send a library book to Kindle"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            kindle_sender = get_kindle_sender()
            if not kindle_sender:
                return jsonify({"error": "Kindle sender not available"}), 503
            
            # Get user's Kindle email
            user_kindle_email = kindle_sender.get_user_kindle_email(username)
            if not user_kindle_email:
                return jsonify({"error": "No Kindle email configured for user"}), 400
            
            # Get book from Calibre library
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({"error": "Library database not available"}), 503
            
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({"error": "Book not found in library"}), 404
            
            # Send to Kindle using library book
            success = kindle_sender.send_library_book_to_kindle(
                book_id=book_id,
                book_title=book['title'],
                book_author=book['authors'],
                recipient_email=user_kindle_email
            )
            
            if success:
                return jsonify({
                    "success": True,
                    "message": f"Book sent to {user_kindle_email} successfully"
                })
            else:
                return jsonify({"error": "Failed to send book to Kindle"}), 500
                
        except Exception as e:
            logger.error(f"Send library book to Kindle error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/user/kindle-email', methods=['GET'])
    @app.login_required
    def api_get_user_kindle_email():
        """Get user's Kindle email address"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            kindle_sender = get_kindle_sender()
            if not kindle_sender:
                return jsonify({"error": "Kindle sender not available"}), 503
            
            kindle_email = kindle_sender.get_user_kindle_email(username)
            
            return jsonify({
                "kindle_email": kindle_email,
                "configured": bool(kindle_email)
            })
            
        except Exception as e:
            logger.error(f"Get Kindle email error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/user/kindle-email', methods=['POST'])
    @app.login_required
    def api_update_user_kindle_email():
        """Update user's Kindle email address"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            data = request.get_json()
            if not data or 'kindle_email' not in data:
                return jsonify({"error": "Kindle email not provided"}), 400
            
            kindle_email = data['kindle_email'].strip()
            
            # Validate email format (basic validation)
            if kindle_email and '@' not in kindle_email:
                return jsonify({"error": "Invalid email format"}), 400
            
            # Update user's Kindle email in database
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            
            if not cwa_db:
                return jsonify({"error": "User database not available"}), 503
            
            success = cwa_db.update_user_kindle_email(username, kindle_email)
            
            if success:
                return jsonify({
                    "success": True,
                    "message": "Kindle email updated successfully",
                    "kindle_email": kindle_email
                })
            else:
                return jsonify({"error": "Failed to update Kindle email"}), 500
                
        except Exception as e:
            logger.error(f"Update Kindle email error: {e}")
            return jsonify({"error": str(e)}), 500
