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

def _format_date_for_input(date_string: str) -> str:
    """Convert ISO date string to YYYY-MM-DD format for HTML date input"""
    if not date_string:
        return ''
    
    try:
        # Extract just the date part from ISO string (avoid timezone conversion)
        date_part = date_string.split('T')[0]
        # Validate it's in YYYY-MM-DD format
        if len(date_part) == 10 and date_part[4] == '-' and date_part[7] == '-':
            return date_part
        return ''
    except Exception:
        return ''

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
                return jsonify({'error': 'User not authenticated'}), 401
            
            data = request.get_json() or {}
            user_message = data.get('message', '')
            
            # Get book from Calibre library
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Library not available'}), 503
            
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            # Find best format for Kindle (prefer EPUB, then MOBI, then any)
            formats = book.get('formats', [])  # formats is a list of {'format': 'EPUB', 'size': 123}
            preferred_formats = ['EPUB', 'MOBI', 'AZW3', 'PDF']
            
            book_file_data = None
            book_format = None
            
            # Convert formats list to available format names
            available_formats = [fmt['format'] for fmt in formats]
            
            # Try preferred formats first
            for fmt in preferred_formats:
                if fmt in available_formats:
                    book_file_data = calibre_db.get_book_file(book_id, fmt)
                    if book_file_data:
                        book_format = fmt
                        break
            
            # If preferred formats didn't work, try any available format
            if not book_file_data:
                for fmt_info in formats:
                    fmt = fmt_info['format']
                    book_file_data = calibre_db.get_book_file(book_id, fmt)
                    if book_file_data:
                        book_format = fmt
                        break
            
            if not book_file_data:
                return jsonify({'error': 'No readable book file found'}), 404
            
            # Write the book data to a temporary file for sending
            import tempfile
            from pathlib import Path
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{book_format.lower()}') as temp_file:
                temp_file.write(book_file_data)
                book_path = Path(temp_file.name)
            
            book_title = book.get('title', f'Book {book_id}')
            
            # Send to Kindle using our direct implementation
            from ...core.kindle_sender import get_kindle_sender
            kindle_sender = get_kindle_sender()
            
            try:
                result = kindle_sender.send_book_to_kindle(
                    username=username,
                    book_path=book_path,
                    book_title=book_title,
                    user_message=user_message
                )
                
                if result['success']:
                    result['format'] = book_format
                    return jsonify(result)
                else:
                    return jsonify(result), 400
                    
            finally:
                # Clean up temporary file
                import os
                try:
                    os.unlink(book_path)
                except:
                    pass  # Ignore cleanup errors
                
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
            
            
            # Helper function to safely extract string values from various data types
            def safe_join(data, default=''):
                if not data:
                    return default
                if isinstance(data, str):
                    return data
                if isinstance(data, list):
                    # Handle list of strings or list of dicts
                    result = []
                    for item in data:
                        if isinstance(item, str):
                            result.append(item)
                        elif isinstance(item, dict):
                            # Extract name/title/code from dict if available
                            if 'code' in item:  # Language objects have 'code' field
                                result.append(item.get('code', str(item)))
                            else:
                                result.append(item.get('name', item.get('title', str(item))))
                        else:
                            result.append(str(item))
                    return ', '.join(result)
                if isinstance(data, dict):
                    # If it's a dict, try to get code (for languages) or name/title
                    if 'code' in data:  # Language objects have 'code' field
                        return data.get('code', str(data))
                    else:
                        return data.get('name', data.get('title', str(data)))
                return str(data)
            
            # Format metadata for frontend (matching the expected BookMetadata interface)
            # Handle series specially since it's a single object, not a list
            series_name = ''
            series_index = ''
            if book.get('series'):
                if isinstance(book['series'], dict):
                    series_name = book['series'].get('name', '')
                    series_index = str(book['series'].get('index', ''))
                else:
                    series_name = str(book['series'])
            
            metadata = {
                'title': book.get('title', ''),
                'authors': safe_join(book.get('authors')),
                'comments': book.get('comments', ''),
                'tags': safe_join(book.get('tags')),
                'series': series_name,
                'series_index': series_index,
                'publisher': safe_join(book.get('publishers', '')),
                'rating': str(int(book.get('rating', 0) / 2)) if book.get('rating') else '',  # Convert to match display logic (0-5 to 0-2.5)
                'pubdate': _format_date_for_input(book.get('pubdate', '')),  # Convert to YYYY-MM-DD format for date input
                'language': safe_join(book.get('languages')),
                'isbn': book.get('identifiers', {}).get('isbn', '') or book.get('isbn', '')
            }
            
            # Return in the format expected by MetadataEditModal
            return jsonify({
                'metadata': metadata,
                'csrf_token': 'dummy_token'  # Not needed for our implementation but expected by frontend
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
