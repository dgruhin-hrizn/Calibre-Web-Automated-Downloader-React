"""
Metadata Routes Module
Handles direct metadata database access endpoints
"""

import io
from flask import request, jsonify, session, send_file
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger
from ...integrations.calibre.db_manager import CalibreDBManager
from ...infrastructure.env import CALIBRE_LIBRARY_PATH

logger = setup_logger(__name__)

def get_calibre_db_manager():
    """Get or create Calibre DB manager instance"""
    try:
        return CalibreDBManager(CALIBRE_LIBRARY_PATH)
    except Exception as e:
        logger.error(f"Failed to get Calibre database manager: {e}")
        return None

def enrich_books_with_read_status(books, username):
    """Enrich books with read status for authenticated user"""
    try:
        from ...integrations.calibre.read_status_manager import get_read_status_manager
        read_status_manager = get_read_status_manager()
        if not read_status_manager:
            return books
            
        # Get read status for all books
        book_ids = [book['id'] for book in books]
        read_statuses = read_status_manager.get_read_statuses(username, book_ids)
        
        # Enrich each book with its read status
        for book in books:
            book_id = book['id']
            if book_id in read_statuses:
                book['read_status'] = read_statuses[book_id]
            else:
                book['read_status'] = {'status': 'unread', 'progress': 0}
                
        return books
    except Exception as e:
        logger.error(f"Error enriching books with read status: {e}")
        return books

def register_routes(app):
    """Register metadata routes with the Flask app"""
    
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
                per_page = min(int(request.args.get('limit', 20)), 100)
                page = (offset // per_page) + 1
            else:
                # Using page/per_page style
                page = int(request.args.get('page', 1))
                per_page = min(int(request.args.get('per_page', 20)), 100)
                
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
            
            # Enrich with read status if user is authenticated
            username = session.get('username')
            if username:
                result['books'] = enrich_books_with_read_status(result['books'], username)
            
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
            
            # Enrich with read status if user is authenticated
            username = session.get('username')
            if username:
                enriched_books = enrich_books_with_read_status([book], username)
                book = enriched_books[0] if enriched_books else book
                
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

    @app.route('/api/metadata/new-books')
    def api_metadata_new_books():
        """Get recently added books (equivalent to OPDS /new)"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            # Get new books sorted by timestamp desc
            result = db_manager.get_books(page=page, per_page=per_page, sort='new')
            
            return jsonify({
                'books': result['books'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching new books: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/discover-books')
    def api_metadata_discover_books():
        """Get random books for discovery (equivalent to OPDS /discover)"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get per_page parameter (no pagination for random books)
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            # Get random books
            result = db_manager.get_random_books(limit=per_page)
            
            return jsonify({
                'books': result['books'],
                'total': result['total'],
                'page': 1,
                'per_page': per_page,
                'pages': 1
            })
            
        except Exception as e:
            logger.error(f"Error fetching random books: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/rated-books')
    def api_metadata_rated_books():
        """Get best rated books (equivalent to OPDS /rated)"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            # Get highly rated books (rating > 4.5 stars, which is 9/10 in Calibre)
            result = db_manager.get_rated_books(page=page, per_page=per_page)
            
            return jsonify({
                'books': result['books'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching rated books: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/authors')
    def api_metadata_authors_list():
        """Get list of all authors (equivalent to OPDS /author)"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 50)), 200)
            search = request.args.get('search', '').strip()
            
            # Get authors list with book counts
            result = db_manager.get_authors_with_counts(page=page, per_page=per_page, search=search)
            
            return jsonify({
                'authors': result['authors'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching authors: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/authors/<int:author_id>/books')
    def api_metadata_author_books(author_id):
        """Get books by specific author"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            # Get books by author
            result = db_manager.get_books_by_author(author_id, page=page, per_page=per_page)
            
            return jsonify({
                'books': result['books'],
                'author': result['author'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching books by author: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/series')
    def api_metadata_series_list():
        """Get list of all series (equivalent to OPDS /series)"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 50)), 200)
            search = request.args.get('search', '').strip()
            starts_with = request.args.get('starts_with', '').strip()
            
            # Get series list with book counts
            result = db_manager.get_series_with_counts(page=page, per_page=per_page, search=search, starts_with=starts_with)
            
            return jsonify({
                'series': result['series'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching series: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/series/<int:series_id>/books')
    def api_metadata_series_books(series_id):
        """Get books in specific series"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            # Get books in series
            result = db_manager.get_books_in_series(series_id, page=page, per_page=per_page)
            
            return jsonify({
                'books': result['books'],
                'series': result['series'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching books in series: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/tags')
    def api_metadata_tags_list():
        """Get list of all tags/categories (equivalent to OPDS /category)"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 50)), 200)
            search = request.args.get('search', '').strip()
            
            # Get tags list with book counts
            result = db_manager.get_tags_with_counts(page=page, per_page=per_page, search=search)
            
            return jsonify({
                'tags': result['tags'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching tags: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/metadata/tags/<int:tag_id>/books')
    def api_metadata_tag_books(tag_id):
        """Get books with specific tag"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            # Get books with tag
            result = db_manager.get_books_by_tag(tag_id, page=page, per_page=per_page)
            
            return jsonify({
                'books': result['books'],
                'tag': result['tag'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"Error fetching books by tag: {e}")
            return jsonify({'error': str(e)}), 500
