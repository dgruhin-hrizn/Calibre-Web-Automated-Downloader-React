"""
CWA Compatibility Routes Module
Provides CWA-compatible endpoints using direct database access
"""

from flask import request, jsonify, session
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger

logger = setup_logger(__name__)

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
    """Register CWA compatibility routes with the Flask app"""
    
    @app.route('/api/cwa/status')
    def api_cwa_status():
        """CWA-compatible status endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({
                    'status': 'error',
                    'message': 'Database not available'
                }), 503
            
            return jsonify({
                'status': 'healthy',
                'version': 'inkdrop-independent',
                'database': 'connected',
                'independent': True
            })
            
        except Exception as e:
            logger.error(f"CWA status error: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @app.route('/api/cwa/health')
    def api_cwa_health():
        """CWA-compatible health check endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            return jsonify({
                'healthy': calibre_db is not None,
                'database': 'connected' if calibre_db else 'disconnected',
                'independent': True
            })
        except Exception as e:
            logger.error(f"CWA health error: {e}")
            return jsonify({'healthy': False, 'error': str(e)}), 500

    @app.route('/api/cwa/books')
    @app.login_required
    def api_cwa_books():
        """CWA-compatible books listing endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            # Get query parameters
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            search = request.args.get('search', '').strip()
            sort = request.args.get('sort', 'timestamp')
            
            result = calibre_db.get_books(
                page=page,
                per_page=per_page,
                search=search,
                sort=sort
            )
            
            return jsonify({
                'books': result['books'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"CWA books error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/search')
    @app.login_required
    def api_cwa_search():
        """CWA-compatible search endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            # Get search parameters
            query = request.args.get('q', '').strip()
            if not query:
                return jsonify({'books': [], 'total': 0, 'page': 1, 'per_page': 20, 'pages': 0})
            
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 20)), 100)
            
            result = calibre_db.get_books(search=query, page=page, per_page=per_page)
            
            return jsonify({
                'books': result['books'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"CWA search error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/book/<int:book_id>')
    @app.login_required
    def api_cwa_book_details(book_id: int):
        """CWA-compatible book details endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            book = calibre_db.get_book_details(book_id)
            if not book:
                return jsonify({'error': 'Book not found'}), 404
            
            return jsonify(book)
            
        except Exception as e:
            logger.error(f"CWA book details error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/book/<int:book_id>/formats')
    @app.login_required
    def api_cwa_book_formats(book_id: int):
        """CWA-compatible book formats endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            formats = calibre_db.get_book_formats(book_id)
            if not formats:
                return jsonify({'error': 'Book not found'}), 404
            
            return jsonify({'formats': formats})
            
        except Exception as e:
            logger.error(f"CWA book formats error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/book/<int:book_id>/cover')
    def api_cwa_book_cover(book_id: int):
        """CWA-compatible book cover endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            cover_data = calibre_db.get_book_cover(book_id)
            if not cover_data:
                return jsonify({'error': 'Cover not found'}), 404
            
            from flask import send_file
            import io
            return send_file(
                io.BytesIO(cover_data),
                mimetype='image/jpeg',
                as_attachment=False
            )
            
        except Exception as e:
            logger.error(f"CWA book cover error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/authors')
    @app.login_required
    def api_cwa_authors():
        """CWA-compatible authors endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 50)), 200)
            search = request.args.get('search', '').strip()
            
            result = calibre_db.get_authors_with_counts(
                page=page, 
                per_page=per_page, 
                search=search
            )
            
            return jsonify(result)
            
        except Exception as e:
            logger.error(f"CWA authors error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/series')
    @app.login_required
    def api_cwa_series():
        """CWA-compatible series endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 50)), 200)
            search = request.args.get('search', '').strip()
            
            result = calibre_db.get_series_with_counts(
                page=page, 
                per_page=per_page, 
                search=search
            )
            
            return jsonify(result)
            
        except Exception as e:
            logger.error(f"CWA series error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/categories')
    @app.login_required
    def api_cwa_categories():
        """CWA-compatible categories/tags endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 50)), 200)
            search = request.args.get('search', '').strip()
            
            result = calibre_db.get_tags_with_counts(
                page=page, 
                per_page=per_page, 
                search=search
            )
            
            return jsonify({
                'categories': result['tags'],
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'pages': result['pages']
            })
            
        except Exception as e:
            logger.error(f"CWA categories error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/user/permissions')
    @app.login_required
    def api_cwa_user_permissions():
        """CWA-compatible user permissions endpoint"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({'error': 'Not authenticated'}), 401
            
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            
            if not cwa_db:
                return jsonify({'error': 'User database not available'}), 503
            
            permissions = cwa_db.get_user_permissions(username)
            
            return jsonify({
                'username': username,
                'permissions': permissions
            })
            
        except Exception as e:
            logger.error(f"CWA user permissions error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/cwa/stats')
    @app.login_required
    def api_cwa_stats():
        """CWA-compatible library statistics endpoint"""
        try:
            calibre_db = get_calibre_db_manager()
            if not calibre_db:
                return jsonify({'error': 'Database not available'}), 503
            
            stats = calibre_db.get_library_stats()
            
            return jsonify({
                'library': stats,
                'independent': True
            })
            
        except Exception as e:
            logger.error(f"CWA stats error: {e}")
            return jsonify({'error': str(e)}), 500
