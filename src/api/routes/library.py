"""
Library Routes Module
Handles library actions, book editing, and cover management endpoints
"""

import io
from flask import request, jsonify, session, send_file
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger

logger = setup_logger(__name__)

def get_calibre_db_manager():
    """Get Calibre database manager instance"""
    from ...integrations.calibre.db_manager import CalibreDBManager
    from ...infrastructure.env import CALIBRE_LIBRARY_PATH
    try:
        return CalibreDBManager(CALIBRE_LIBRARY_PATH)
    except Exception as e:
        logger.error(f"Failed to get Calibre database manager: {e}")
        return None

def register_routes(app):
    """Register library routes with the Flask app"""
    
    @app.route('/api/cwa/library/books/<int:book_id>/download/<format>')
    @app.login_required
    def api_cwa_library_download(book_id: int, format: str):
        """Download a book from the library in specified format"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library database not available'}), 503
            
            # Get book details first
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            # Get book file data
            book_data = calibre_db.get_book_file(book_id, format.upper())
            if not book_data:
                return jsonify({'error': f'Book format {format} not available'}), 404
            
            # Sanitize filename
            import re
            filename = f"{book['title']}.{format.lower()}"
            filename = re.sub(r'[\\/:*?"<>|]', '_', filename)
            
            return send_file(
                io.BytesIO(book_data),
                download_name=filename,
                as_attachment=True,
                mimetype='application/octet-stream'
            )
            
        except Exception as e:
            logger.error(f"Library download error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/library/books/<int:book_id>/send-to-kindle', methods=['POST'])
    @app.login_required
    def api_cwa_library_send_to_kindle(book_id: int):
        """Send a library book to Kindle"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({'error': 'Not authenticated'}), 401
            
            from ...core.kindle_sender import get_kindle_sender
            kindle_sender = get_kindle_sender()
            
            if not kindle_sender:
                return jsonify({'error': 'Kindle sender not available'}), 503
            
            # Get user's Kindle email
            user_kindle_email = kindle_sender.get_user_kindle_email(username)
            if not user_kindle_email:
                return jsonify({'error': 'No Kindle email configured'}), 400
            
            # Get book details
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library database not available'}), 503
            
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            # Send to Kindle
            success = kindle_sender.send_library_book_to_kindle(
                book_id=book_id,
                book_title=book['title'],
                book_author=book['authors'],
                recipient_email=user_kindle_email
            )
            
            if success:
                return jsonify({
                    'success': True,
                    'message': f"Book sent to {user_kindle_email} successfully"
                })
            else:
                return jsonify({'error': 'Failed to send book to Kindle'}), 500
                
        except Exception as e:
            logger.error(f"Library send to Kindle error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/book/<int:book_id>/download/<format>')
    @app.login_required
    def api_cwa_book_download(book_id: int, format: str):
        """Alternative endpoint for book download"""
        return api_cwa_library_download(book_id, format)

    @app.route('/api/cwa/book/<int:book_id>/reader')
    @app.login_required
    def api_cwa_book_reader(book_id: int):
        """Get book content for in-browser reading"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library database not available'}), 503
            
            # Try to get EPUB format first, then fallback to other formats
            formats_to_try = ['EPUB', 'PDF', 'MOBI', 'AZW3']
            
            for format_type in formats_to_try:
                book_data = calibre_db.get_book_file(book_id, format_type)
                if book_data:
                    return send_file(
                        io.BytesIO(book_data),
                        mimetype='application/epub+zip' if format_type == 'EPUB' else 'application/octet-stream',
                        as_attachment=False
                    )
            
            return jsonify({'error': 'No readable format available'}), 404
            
        except Exception as e:
            logger.error(f"Book reader error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/library/books/<int:book_id>/edit', methods=['GET'])
    @app.login_required
    def api_cwa_library_book_edit_get(book_id: int):
        """Get book metadata for editing"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library database not available'}), 503
            
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            # Return book metadata in editable format
            return jsonify({
                'book': book,
                'editable_fields': [
                    'title', 'authors', 'series', 'series_index', 
                    'tags', 'rating', 'published', 'publisher',
                    'isbn', 'comments', 'languages'
                ]
            })
            
        except Exception as e:
            logger.error(f"Book edit get error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/library/books/<int:book_id>/edit', methods=['POST'])
    @app.admin_required
    def api_cwa_library_book_edit_post(book_id: int):
        """Update book metadata"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library database not available'}), 503
            
            # Verify book exists
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            # Update book metadata
            success = calibre_db.update_book_metadata(book_id, data)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': 'Book metadata updated successfully',
                    'book_id': book_id
                })
            else:
                return jsonify({'error': 'Failed to update book metadata'}), 500
                
        except Exception as e:
            logger.error(f"Book edit post error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/library/books/<int:book_id>/cover', methods=['POST'])
    @app.admin_required
    def api_cwa_library_book_cover_upload(book_id: int):
        """Upload new cover for a book"""
        try:
            if 'cover' not in request.files:
                return jsonify({'error': 'No cover file provided'}), 400
            
            cover_file = request.files['cover']
            if cover_file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            
            # Validate file type
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
            if cover_file.content_type not in allowed_types:
                return jsonify({'error': 'Invalid file type. Only JPEG, PNG, and GIF are allowed'}), 400
            
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library database not available'}), 503
            
            # Read cover data
            cover_data = cover_file.read()
            if len(cover_data) > 5 * 1024 * 1024:  # 5MB limit
                return jsonify({'error': 'Cover file too large (max 5MB)'}), 400
            
            # Update book cover
            success = calibre_db.update_book_cover(book_id, cover_data)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': 'Book cover updated successfully',
                    'book_id': book_id
                })
            else:
                return jsonify({'error': 'Failed to update book cover'}), 500
                
        except Exception as e:
            logger.error(f"Book cover upload error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/library/books/<int:book_id>/delete', methods=['DELETE'])
    @app.admin_required
    def api_cwa_library_book_delete(book_id: int):
        """Delete a book from the library"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library database not available'}), 503
            
            # Verify book exists
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            # Delete book
            success = calibre_db.delete_book(book_id)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': 'Book deleted successfully',
                    'book_id': book_id
                })
            else:
                return jsonify({'error': 'Failed to delete book'}), 500
                
        except Exception as e:
            logger.error(f"Book delete error: {e}")
            return jsonify({'error': str(e)}), 500
