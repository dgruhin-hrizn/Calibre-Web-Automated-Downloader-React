"""
Download Routes Module
Handles download queue, history, status, and management endpoints
"""

import io
import re
from pathlib import Path
from flask import request, jsonify, session, send_file
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger
from ...infrastructure.env import INGEST_DIR
from ...core import backend

logger = setup_logger(__name__)

class SearchFilters:
    def __init__(self, isbn=None, author=None, title=None, lang=None, sort=None, content=None, format=None):
        self.isbn = isbn or []
        self.author = author or []
        self.title = title or []
        self.lang = lang or []
        self.sort = sort
        self.content = content or []
        self.format = format or []

def get_downloads_db_manager():
    """Get downloads database manager instance"""
    from ...infrastructure.downloads_db import DownloadsDBManager
    from ...infrastructure.env import DOWNLOADS_DB_PATH
    try:
        return DownloadsDBManager(DOWNLOADS_DB_PATH)
    except Exception as e:
        logger.error(f"Failed to get downloads database manager: {e}")
        return None

def get_current_user():
    """Get current authenticated user from session"""
    return session.get('username')

def register_routes(app):
    """Register download routes with the Flask app"""
    
    @app.route('/api/search', methods=['GET'])
    @app.login_required
    def api_search():
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
            logger.error(f"Search error: {e}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/download', methods=['GET'])
    @app.login_required
    def api_download():
        """
        Queue a book for download.

        Query Parameters:
            id (str): Book identifier (MD5 hash)
            cover_url (str, optional): Book cover image URL from search results
            priority (int, optional): Download priority (default: 0)
            search_url (str, optional): Original search URL

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
            logger.error(f"Download error: {e}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/localdownload', methods=['GET'])
    @app.login_required
    def api_local_download():
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
            # Sanitize the file name
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
            logger.error(f"Local download error: {e}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/downloads/history', methods=['GET'])
    @app.login_required
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
    @app.login_required
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
            
            # Get all active book IDs from the in-memory queue
            # Include 'available' to handle the brief window before cleanup
            active_queue_book_ids = set()
            for queue_status in ['queued', 'downloading', 'processing', 'waiting', 'available']:
                if queue_status in global_status:
                    active_queue_book_ids.update(global_status[queue_status].keys())
            
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
                            
                            # Only enrich with queue data if it has valid metadata
                            # Prevent corrupted/incomplete queue data from overriding good database data
                            queue_title = getattr(queue_data, 'title', None)
                            queue_author = getattr(queue_data, 'author', None)
                            
                            # Update progress and real-time data regardless
                            enriched_record.update({
                                'progress': getattr(queue_data, 'progress', 0),
                                'download_speed': getattr(queue_data, 'download_speed', None),
                                'eta_seconds': getattr(queue_data, 'eta_seconds', None),
                                'wait_time': getattr(queue_data, 'wait_time', None),
                                'wait_start': getattr(queue_data, 'wait_start', None),
                                'error': getattr(queue_data, 'error', None)
                            })
                            
                            # Only override title/author if queue has better data than database
                            if queue_title and queue_title.strip() and queue_title != 'Unknown':
                                enriched_record['title'] = queue_title
                            if queue_author and queue_author.strip() and queue_author != 'Unknown Author':
                                enriched_record['author'] = queue_author
                        
                        enriched_downloads.append(enriched_record)
                    
                    downloads_by_status[status] = enriched_downloads
            
            # Filter out completed/error/cancelled downloads that are still active in the queue
            # This prevents duplication during the brief window when items are transitioning
            for status in ['completed', 'error', 'cancelled']:
                if status in downloads_by_status:
                    filtered_downloads = []
                    for db_record in downloads_by_status[status]:
                        book_id = db_record['book_id']
                        
                        # Only include if NOT still active in the queue
                        if book_id not in active_queue_book_ids:
                            enriched_record = {
                                'id': book_id,
                                'title': db_record['book_title'],
                                'author': db_record['book_author'], 
                                'format': db_record['book_format'],
                                'cover_url': db_record['cover_url'],
                                'preview': db_record['cover_url'],  # Alias for compatibility
                                'progress': 100 if status == 'completed' else 0,
                                'status': status
                            }
                            filtered_downloads.append(enriched_record)
                    
                    downloads_by_status[status] = filtered_downloads
            
            return jsonify(downloads_by_status)
            
        except Exception as e:
            logger.error(f"Error getting user download status: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/downloads/stats', methods=['GET'])
    @app.login_required
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
    @app.login_required
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
    @app.login_required
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
        """Get current download queue status"""
        try:
            status = backend.queue_status()
            return jsonify(status)
        except Exception as e:
            logger.error(f"Status error: {e}")
            return jsonify({"error": str(e)}), 500


    @app.route('/api/download/<book_id>/cancel', methods=['DELETE'])
    @app.login_required
    def api_cancel_download(book_id: str) -> Union[Response, Tuple[Response, int]]:
        """Cancel a download"""
        try:
            success = backend.cancel_download(book_id)
            if success:
                return jsonify({"status": "cancelled", "book_id": book_id})
            return jsonify({"error": "Failed to cancel download or book not found"}), 404
        except Exception as e:
            logger.error(f"Cancel download error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/download/<book_id>/force-cancel', methods=['DELETE'])
    @app.login_required
    def api_force_cancel_download(book_id: str) -> Union[Response, Tuple[Response, int]]:
        """Force cancel a stuck download regardless of status"""
        try:
            success = backend.force_cancel_download(book_id)
            if success:
                return jsonify({"status": "force_cancelled", "book_id": book_id})
            return jsonify({"error": "Book not found in queue"}), 404
        except Exception as e:
            logger.error(f"Force cancel download error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/download/<book_id>/remove-tracking', methods=['DELETE'])
    @app.login_required
    def api_remove_tracking(book_id: str) -> Union[Response, Tuple[Response, int]]:
        """Remove a book from all tracking (for phantom/stuck entries)"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "User not logged in"}), 401
                
            downloads_db = get_downloads_db_manager()
            if not downloads_db:
                return jsonify({"error": "Downloads database not available"}), 503
            
            # Handle both database ID (numeric) and book hash ID cases
            cancelled_count = 0
            actual_book_id = book_id
            
            if book_id.isdigit():
                # This is a database ID, get the actual book_id from the record
                logger.info(f"Received database ID {book_id}, looking up actual book_id")
                with downloads_db._get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT book_id FROM download_history WHERE id = ? AND username = ?", (int(book_id), username))
                    result = cursor.fetchone()
                    if result:
                        actual_book_id = result[0]
                        logger.info(f"Found actual book_id: {actual_book_id}")
                        
                        # Cancel this specific database record
                        cursor.execute("""
                            UPDATE download_history 
                            SET status = 'cancelled', 
                                completed_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP,
                                error_message = 'Manually cancelled via remove tracking'
                            WHERE id = ? AND username = ?
                        """, (int(book_id), username))
                        cancelled_count = cursor.rowcount
                        conn.commit()
                    else:
                        return jsonify({"error": f"Database record {book_id} not found or not owned by user"}), 404
            else:
                # This is a book hash, use the phantom downloads method
                cancelled_count = downloads_db.cancel_phantom_downloads(book_id)
            
            # Remove from queue manager (if exists) - use actual book_id
            backend.remove_from_tracking(actual_book_id)
            
            logger.info(f"Removed tracking for {actual_book_id} (original ID: {book_id}), cancelled {cancelled_count} database entries")
            
            return jsonify({
                "status": "removed_from_tracking", 
                "book_id": actual_book_id,
                "original_id": book_id,
                "cancelled_count": cancelled_count,
                "message": f"Removed from both queue and database ({cancelled_count} records cancelled)"
            })
        except Exception as e:
            logger.error(f"Remove tracking error for {book_id}: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/queue/<book_id>/priority', methods=['PUT'])
    @app.login_required
    def api_set_priority(book_id: str) -> Union[Response, Tuple[Response, int]]:
        """Set priority for a queued book"""
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
            logger.error(f"Set priority error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/queue/reorder', methods=['POST'])
    @app.login_required
    def api_reorder_queue() -> Union[Response, Tuple[Response, int]]:
        """Bulk reorder queue by setting new priorities"""
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
            logger.error(f"Reorder queue error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/queue/order', methods=['GET'])
    @app.login_required
    def api_queue_order() -> Union[Response, Tuple[Response, int]]:
        """Get current queue order for display"""
        try:
            queue_order = backend.get_queue_order()
            return jsonify({"queue": queue_order})
        except Exception as e:
            logger.error(f"Queue order error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/downloads/active', methods=['GET'])
    @app.login_required
    def api_active_downloads() -> Union[Response, Tuple[Response, int]]:
        """Get list of currently active downloads"""
        try:
            active_downloads = backend.get_active_downloads()
            return jsonify({"active_downloads": active_downloads})
        except Exception as e:
            logger.error(f"Active downloads error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/queue/clear', methods=['DELETE'])
    @app.login_required
    def api_clear_completed() -> Union[Response, Tuple[Response, int]]:
        """Clear all completed, errored, or cancelled books from tracking"""
        try:
            removed_count = backend.clear_completed()
            return jsonify({"status": "cleared", "removed_count": removed_count})
        except Exception as e:
            logger.error(f"Clear completed error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/queue/cleanup-phantom', methods=['POST'])
    @app.login_required
    def api_cleanup_phantom_entries() -> Union[Response, Tuple[Response, int]]:
        """Clean up phantom queue entries with incomplete metadata"""
        try:
            cleaned_count = backend.cleanup_phantom_entries()
            return jsonify({
                "status": "cleaned",
                "cleaned_count": cleaned_count,
                "message": f"Cleaned up {cleaned_count} phantom entries"
            })
        except Exception as e:
            logger.error(f"Cleanup phantom entries error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/downloads/cleanup-phantom', methods=['POST'])
    @app.login_required
    def api_cleanup_phantom_downloads() -> Union[Response, Tuple[Response, int]]:
        """Clean up downloads with missing or invalid metadata"""
        try:
            username = get_current_user()
            downloads_db = get_downloads_db_manager()
            if not downloads_db:
                return jsonify({'error': 'Downloads database not available'}), 500
            
            cleaned_count = downloads_db.cleanup_phantom_downloads(username)
            return jsonify({
                'status': 'cleaned',
                'cleaned_count': cleaned_count,
                'message': f'Cleaned up {cleaned_count} phantom download records'
            })
        except Exception as e:
            logger.error(f"Error cleaning up phantom downloads: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/debug/queue-status', methods=['GET'])
    @app.login_required  
    def api_debug_queue_status() -> Union[Response, Tuple[Response, int]]:
        """Debug endpoint to see raw queue status"""
        try:
            username = get_current_user()
            downloads_db = get_downloads_db_manager()
            
            # Get raw queue status
            global_status = backend.queue_status()
            
            # Get database status
            db_status = downloads_db.get_user_downloads_by_status(username) if downloads_db else {}
            
            return jsonify({
                'queue_status': global_status,
                'database_status': db_status,
                'username': username
            })
        except Exception as e:
            logger.error(f"Error getting debug queue status: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/notifications/recent', methods=['GET'])
    @app.login_required
    def api_get_recent_notifications() -> Union[Response, Tuple[Response, int]]:
        """Get recent notifications for the current user"""
        try:
            from ...infrastructure.notification_manager import NotificationManager
            
            limit = int(request.args.get('limit', 10))
            notification_manager = NotificationManager.get_instance()
            notifications = notification_manager.get_recent_notifications(limit)
            
            return jsonify({
                "notifications": notifications,
                "count": len(notifications)
            })
        except Exception as e:
            logger.error(f"Get notifications error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/downloads/history/clear', methods=['DELETE'])
    @app.login_required
    def api_clear_download_history() -> Union[Response, Tuple[Response, int]]:
        """Clear all download history for the current user"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "User not logged in"}), 401
            
            downloads_db = get_downloads_db_manager()
            if not downloads_db:
                return jsonify({"error": "Downloads database not available"}), 503
            
            cleared_count = downloads_db.clear_user_download_history(username)
            return jsonify({
                "cleared": cleared_count,
                "message": f"Cleared {cleared_count} download history records"
            })
        except Exception as e:
            logger.error(f"Clear download history error: {e}")
            return jsonify({"error": str(e)}), 500
