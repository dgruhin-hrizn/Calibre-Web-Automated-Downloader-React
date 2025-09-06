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
            
            # Get or create user ID
            user_id = read_status_manager.get_or_create_user(username)
            
            # Get read status
            status = read_status_manager.get_book_read_status(book_id, user_id)
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
                return jsonify({"error": "No data provided"}), 400
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            # Get or create user ID
            user_id = read_status_manager.get_or_create_user(username)
            
            # Handle different actions
            action = data.get('action')
            if action == 'toggle':
                status = read_status_manager.toggle_book_read_status(book_id, user_id)
            elif action == 'mark_read':
                read_status_manager.mark_as_read(book_id, user_id)
                status = read_status_manager.get_book_read_status(book_id, user_id)
            elif action == 'mark_unread':
                read_status_manager.mark_as_unread(book_id, user_id)
                status = read_status_manager.get_book_read_status(book_id, user_id)
            elif action == 'mark_in_progress':
                read_status_manager.mark_as_in_progress(book_id, user_id)
                status = read_status_manager.get_book_read_status(book_id, user_id)
            elif action == 'mark_want_to_read':
                read_status_manager.mark_as_want_to_read(book_id, user_id)
                status = read_status_manager.get_book_read_status(book_id, user_id)
            else:
                return jsonify({"error": "Invalid action. Use: toggle, mark_read, mark_unread, mark_in_progress, mark_want_to_read"}), 400
            
            return jsonify(status)
                
        except Exception as e:
            logger.error(f"Error updating read status: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/books/read-status', methods=['POST'])
    @app.login_required
    def api_get_multiple_books_read_status():
        """Get read status for multiple books for the current user"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "User not authenticated"}), 401
            
            # Get request data
            data = request.get_json()
            if not data or 'book_ids' not in data:
                return jsonify({"error": "book_ids array required"}), 400
            
            book_ids = data['book_ids']
            if not isinstance(book_ids, list):
                return jsonify({"error": "book_ids must be an array"}), 400
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            # Get or create user ID
            user_id = read_status_manager.get_or_create_user(username)
            
            # Get read status for all books
            statuses = read_status_manager.get_multiple_books_read_status(book_ids, user_id)
            
            return jsonify({"book_statuses": statuses})
                
        except Exception as e:
            logger.error(f"Error getting multiple books read status: {e}")
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
            
            # Get or create user ID
            user_id = read_status_manager.get_or_create_user(username)
            
            # Get reading stats
            stats = read_status_manager.get_user_reading_stats(user_id)
            return jsonify(stats)
            
        except Exception as e:
            logger.error(f"Error getting reading stats: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/user/books/<status>', methods=['GET'])
    @app.login_required
    def api_get_user_books_by_status(status: str):
        """Get books by read status for the current user"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "User not authenticated"}), 401
            
            read_status_manager = get_read_status_manager()
            if not read_status_manager:
                return jsonify({"error": "Read status manager not available"}), 503
            
            # Get or create user ID
            user_id = read_status_manager.get_or_create_user(username)
            
            # Get limit and offset from query params
            limit = request.args.get('limit', 50, type=int)
            offset = request.args.get('offset', 0, type=int)
            
            if status == 'all':
                # Use efficient pagination for all user books
                book_ids, total_books = read_status_manager.get_all_user_books_paginated(user_id, limit, offset)
            else:
                # Map status string to constant
                status_map = {
                    'read': read_status_manager.STATUS_FINISHED,
                    'unread': read_status_manager.STATUS_UNREAD,
                    'in_progress': read_status_manager.STATUS_IN_PROGRESS,
                    'want_to_read': read_status_manager.STATUS_WANT_TO_READ
                }
                
                if status not in status_map:
                    return jsonify({"error": "Invalid status. Use: read, unread, in_progress, want_to_read, all"}), 400
                
                # Get books by status
                book_ids = read_status_manager.get_books_by_read_status(user_id, status_map[status], limit, offset)
                total_books = read_status_manager.get_books_count_by_status(user_id, status_map[status])
            
            # Get book data from Calibre database
            books = []
            if book_ids:
                try:
                    from .metadata import get_calibre_db_manager
                    calibre_db = get_calibre_db_manager()
                    if calibre_db:
                        for book_id in book_ids:
                            try:
                                book = calibre_db.get_book_details(book_id)
                                if book:
                                    books.append(book)
                            except Exception as e:
                                logger.warning(f"Could not get book data for ID {book_id}: {e}")
                                continue
                except Exception as e:
                    logger.error(f"Error getting Calibre database: {e}")
            
            # Enrich with read status for authenticated users
            if books:
                from .metadata import enrich_books_with_read_status
                books = enrich_books_with_read_status(books, username)
            
            return jsonify({"books": books, "status": status, "total": total_books})
            
        except Exception as e:
            logger.error(f"Error getting user books by status {status}: {e}")
            return jsonify({"error": str(e)}), 500
