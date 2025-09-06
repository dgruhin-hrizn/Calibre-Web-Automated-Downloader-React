"""
Admin Routes Module
Handles admin management, settings, and administrative endpoints
"""

from flask import request, jsonify, session
from typing import Union, Tuple
from werkzeug.wrappers import Response

from ...infrastructure.logger import setup_logger
from ...infrastructure.inkdrop_settings_manager import get_inkdrop_settings_manager

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
    """Register admin routes with the Flask app"""
    
    @app.route('/api/admin/status')
    @app.login_required
    def api_admin_status():
        """Check if current user has admin privileges"""
        try:
            is_admin = False
            username = session.get('username')
            
            if username:
                # Check admin status directly from database
                from ...infrastructure.cwa_db_manager import get_cwa_db_manager
                cwa_db = get_cwa_db_manager()
                
                if cwa_db:
                    logger.debug(f"Admin status check: Checking database for {username}")
                    user_permissions = cwa_db.get_user_permissions(username)
                    is_admin = user_permissions.get('admin', False)
                    logger.debug(f"Admin status check: Database result = {is_admin}")
                else:
                    logger.warning("Admin status check: CWA database not available")
            else:
                logger.warning("Admin status check: No username in session")
            
            return jsonify({'is_admin': is_admin})
            
        except Exception as e:
            logger.error(f"Admin status check error: {e}")
            return jsonify({'is_admin': False}), 500

    @app.route('/api/admin/user-info')
    @app.login_required
    def api_admin_user_info():
        """Get detailed user information for admin interface"""
        try:
            username = session.get('username')
            if not username:
                return jsonify({"error": "Not authenticated"}), 401
            
            # Check admin status directly from database
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            
            if not cwa_db:
                return jsonify({"error": "User database not available"}), 503
                
            user_permissions = cwa_db.get_user_permissions(username)
            is_admin = user_permissions.get('admin', False)
            
            return jsonify({
                'authenticated': True,
                'username': username,
                'is_admin': is_admin,
                'permissions': user_permissions
            })
            
        except Exception as e:
            logger.error(f"Admin user info error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/settings', methods=['GET'])
    @app.admin_required
    def api_get_admin_settings():
        """Get global admin settings"""
        try:
            from ...infrastructure.app_settings import get_app_settings
            settings = get_app_settings()
            
            # Convert to dict for JSON response
            from dataclasses import asdict
            settings_dict = asdict(settings)
            
            return jsonify({
                'success': True,
                'settings': settings_dict
            })
            
        except Exception as e:
            logger.error(f"Error getting admin settings: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/settings/test-conversion', methods=['POST'])
    @app.admin_required  
    def api_admin_test_conversion():
        """Test if Calibre conversion tools are available (admin only)"""
        try:
            import subprocess
            
            # Test ebook-convert
            try:
                result = subprocess.run([
                    'ebook-convert', '--version'
                ], capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    version_info = result.stdout.strip()
                    
                    # Also test calibredb
                    db_result = subprocess.run([
                        'calibredb', '--version'
                    ], capture_output=True, text=True, timeout=10)
                    
                    if db_result.returncode == 0:
                        db_version = db_result.stdout.strip()
                        
                        return jsonify({
                            'success': True,
                            'available': True,
                            'ebook_convert_version': version_info,
                            'calibredb_version': db_version,
                            'message': 'Calibre tools are available and working'
                        })
                    else:
                        return jsonify({
                            'success': True,
                            'available': False,
                            'error': 'calibredb not available',
                            'message': 'ebook-convert available but calibredb failed'
                        })
                else:
                    return jsonify({
                        'success': True,
                        'available': False,
                        'error': result.stderr or 'ebook-convert failed',
                        'message': 'Calibre tools are not available'
                    })
                    
            except subprocess.TimeoutExpired:
                return jsonify({
                    'success': True,
                    'available': False,
                    'error': 'Command timeout',
                    'message': 'Calibre tools test timed out'
                })
            except FileNotFoundError:
                return jsonify({
                    'success': True,
                    'available': False,
                    'error': 'ebook-convert not found',
                    'message': 'Calibre tools are not installed or not in PATH'
                })
                
        except Exception as e:
            logger.error(f"Error testing Calibre conversion: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/admin/settings', methods=['POST'])
    @app.admin_required
    def api_update_admin_settings():
        """Update global admin settings"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No settings data provided'}), 400
                
            # Update settings using the same method as reference app
            from ...infrastructure.app_settings import update_app_settings
            success = update_app_settings(data)
            
            if success:
                # Get updated settings to return
                from ...infrastructure.app_settings import get_app_settings
                settings = get_app_settings()
                from dataclasses import asdict
                settings_dict = asdict(settings)
                
                return jsonify({
                    'success': True,
                    'message': 'Settings updated successfully',
                    'settings': settings_dict
                })
            else:
                return jsonify({'error': 'Failed to update settings'}), 500
                
        except Exception as e:
            logger.error(f"Error updating admin settings: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/admin/smtp/settings', methods=['GET'])
    @app.admin_required
    def api_get_smtp_settings():
        """Get SMTP configuration settings"""
        try:
            settings_manager = get_inkdrop_settings_manager()
            smtp_settings = settings_manager.get_smtp_settings()
            
            # Convert dataclass to dict and don't return password for security
            from dataclasses import asdict
            settings_dict = asdict(smtp_settings)
            # Remove password from response for security
            settings_dict['has_password'] = bool(settings_dict.get('mail_password'))
            if 'mail_password' in settings_dict:
                del settings_dict['mail_password']
            
            return jsonify(settings_dict)
            
        except Exception as e:
            logger.error(f"Error getting SMTP settings: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/smtp/settings', methods=['POST'])
    @app.admin_required
    def api_update_smtp_settings():
        """Update SMTP configuration settings"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No SMTP settings provided"}), 400
            
            settings_manager = get_inkdrop_settings_manager()
            current_smtp = settings_manager.get_smtp_settings()
            
            # Update fields from request data
            if 'mail_server' in data:
                current_smtp.mail_server = data['mail_server']
            if 'mail_port' in data:
                current_smtp.mail_port = int(data['mail_port'])
            if 'mail_use_ssl' in data:
                current_smtp.mail_use_ssl = bool(data['mail_use_ssl'])
            if 'mail_login' in data:
                current_smtp.mail_login = data['mail_login']
            if 'mail_password' in data and data['mail_password']:  # Only update if password provided
                current_smtp.mail_password = data['mail_password']
            if 'mail_from' in data:
                current_smtp.mail_from = data['mail_from']
            if 'mail_size' in data:
                current_smtp.mail_size = int(data['mail_size'])
            if 'mail_server_type' in data:
                current_smtp.mail_server_type = int(data['mail_server_type'])
            
            # Save updated settings
            if settings_manager.update_smtp_settings(current_smtp):
                return jsonify({
                    "success": True,
                    "message": "SMTP settings updated successfully"
                })
            else:
                return jsonify({"error": "Failed to update SMTP settings"}), 500
            
        except Exception as e:
            logger.error(f"Error updating SMTP settings: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/smtp/test', methods=['POST'])
    @app.admin_required
    def api_test_smtp_connection():
        """Send a test email to verify SMTP settings"""
        try:
            from ...core.kindle_sender import get_kindle_sender
            
            # Get test email from request
            data = request.get_json() or {}
            test_email = data.get('test_email', '').strip()
            
            if not test_email:
                return jsonify({"error": "Test email address is required"}), 400
            
            kindle_sender = get_kindle_sender()
            result = kindle_sender.send_test_email(test_email)
            
            if result['success']:
                return jsonify(result)
            else:
                return jsonify(result), 400
                
        except Exception as e:
            logger.error(f"SMTP test error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/calibre/test', methods=['POST'])
    @app.admin_required
    def api_test_calibre():
        """Test Calibre installation and configuration"""
        try:
            from ...core.conversion_manager import get_conversion_manager
            
            conversion_manager = get_conversion_manager()
            result = conversion_manager.test_calibre_installation()
            
            return jsonify(result)
            
        except Exception as e:
            logger.error(f"Calibre test error: {e}")
            return jsonify({
                "success": False,
                "error": str(e),
                "message": "Failed to test Calibre installation"
            }), 500

    @app.route('/api/admin/conversion/status', methods=['GET'])
    @app.admin_required
    def api_conversion_status():
        """Get conversion manager status"""
        try:
            from ...core.conversion_manager import get_conversion_manager
            import asyncio
            
            # Get or create event loop
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # Run async function
            conversion_manager = loop.run_until_complete(get_conversion_manager())
            
            active_jobs = conversion_manager.get_active_jobs()
            library_stats = conversion_manager.library_manager.get_library_stats()
            
            return jsonify({
                'success': True,
                'conversion_manager_running': conversion_manager.running,
                'active_jobs': active_jobs,
                'library_stats': library_stats
            })
            
        except Exception as e:
            logger.error(f"Conversion status error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/settings/google-books', methods=['GET', 'POST'])
    @app.login_required
    def api_google_books_settings():
        """Get or set Google Books API settings"""
        from ...infrastructure.inkdrop_settings_manager import get_inkdrop_settings_manager, GoogleBooksSettings
        import time
        
        if request.method == 'GET':
            try:
                settings_manager = get_inkdrop_settings_manager()
                settings = settings_manager.get_google_books_settings()
                return jsonify({
                    "apiKey": settings.api_key,
                    "isValid": settings.is_valid,
                    "lastChecked": settings.last_checked
                })
            except Exception as e:
                logger.error(f"Error getting Google Books settings: {e}")
                return jsonify({"error": str(e)}), 500
        
        else:  # POST
            try:
                data = request.get_json()
                api_key = data.get('apiKey', '')
                is_valid = data.get('isValid', False)
                
                settings_manager = get_inkdrop_settings_manager()
                google_settings = GoogleBooksSettings(
                    api_key=api_key,
                    is_valid=is_valid,
                    last_checked=time.strftime("%Y-%m-%d %H:%M:%S") if is_valid else ""
                )
                
                success = settings_manager.update_google_books_settings(google_settings)
                if success:
                    logger.info("Google Books API settings saved successfully to database")
                    return jsonify({"message": "Google Books API settings saved successfully"})
                else:
                    return jsonify({"error": "Failed to save settings to database"}), 500
            except Exception as e:
                logger.error(f"Error saving Google Books settings: {e}")
                return jsonify({"error": str(e)}), 500

    @app.route('/api/settings/google-books/test', methods=['POST'])
    @app.login_required
    def api_test_google_books_key():
        """Test Google Books API key validity"""
        try:
            from ...core import backend
            data = request.get_json()
            api_key = data.get('apiKey', '')
            
            is_valid = backend.test_google_books_api_key(api_key)
            return jsonify({"valid": is_valid})
        except Exception as e:
            logger.error(f"Error testing Google Books API key: {e}")
            return jsonify({"valid": False, "error": str(e)}), 500

    @app.route('/api/google-books/search', methods=['POST'])
    @app.login_required
    def api_google_books_search():
        """Search Google Books API for book information"""
        try:
            from ...core import backend
            data = request.get_json()
            title = data.get('title', '')
            author = data.get('author', '')
            max_results = data.get('maxResults', 10)
            
            logger.info(f"Google Books search request: title='{title}', author='{author}', maxResults={max_results}")
            
            google_data = backend.search_google_books(title, author, max_results=max_results)
            if google_data:
                logger.info(f"Google Books search successful for '{title}'")
                return jsonify(google_data)
            else:
                logger.info(f"No Google Books data found for '{title}'")
                return jsonify({"error": "No data found"}), 404
        except Exception as e:
            logger.error(f"Error searching Google Books: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/google-books/volume/<volume_id>', methods=['GET'])
    @app.login_required
    def api_google_books_volume_details(volume_id: str):
        """Get detailed Google Books volume information by volume ID"""
        try:
            from ...core import backend
            logger.info(f"Google Books volume details request for ID: {volume_id}")
            
            volume_data = backend.get_google_books_volume_details(volume_id)
            if volume_data:
                logger.info(f"Google Books volume details successful for '{volume_id}'")
                return jsonify(volume_data)
            else:
                logger.info(f"No Google Books volume data found for '{volume_id}'")
                return jsonify({"error": "Volume not found"}), 404
        except Exception as e:
            logger.error(f"Error getting Google Books volume details: {e}")
            return jsonify({"error": str(e)}), 500

    # User Admin Management Endpoints
    @app.route('/api/useradmin/users', methods=['GET'])
    @app.login_required
    def api_get_users():
        """Get all CWA users via direct database access"""
        try:
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            if not cwa_db:
                return jsonify({"error": "User database not available"}), 503
            
            users = cwa_db.get_all_users()
            return jsonify({"users": users})
            
        except Exception as e:
            logger.error(f"Error getting users: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/useradmin/users/<int:user_id>', methods=['GET'])
    @app.login_required
    def api_get_user_details(user_id: int):
        """Get detailed information for a specific user"""
        try:
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            if not cwa_db:
                return jsonify({"error": "User database not available"}), 503
            
            user = cwa_db.get_user_by_id(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404
            
            return jsonify(user)
            
        except Exception as e:
            logger.error(f"Error getting user details: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/useradmin/users', methods=['POST'])
    @app.login_required
    def api_create_user():
        """Create a new CWA user"""
        try:
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            if not cwa_db:
                return jsonify({"error": "User database not available"}), 503
            
            data = request.get_json()
            if not data:
                return jsonify({"error": "No user data provided"}), 400
            
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
            
            if not username or not email or not password:
                return jsonify({"error": "Username, email, and password are required"}), 400
            
            # Create user
            success = cwa_db.create_user(
                username=username,
                email=email,
                password=password,
                kindle_email=data.get('kindle_email', ''),
                locale=data.get('locale', 'en'),
                default_language=data.get('default_language', 'en'),
                permissions=data.get('permissions', {})
            )
            
            if success:
                return jsonify({
                    "success": True,
                    "message": "User created successfully"
                })
            else:
                return jsonify({"error": "Failed to create user"}), 500
                
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/useradmin/users/<int:user_id>', methods=['PUT'])
    @app.login_required
    def api_update_user(user_id: int):
        """Update user permissions and details"""
        try:
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            if not cwa_db:
                return jsonify({"error": "User database not available"}), 503
            
            data = request.get_json()
            if not data:
                return jsonify({"error": "No user data provided"}), 400
            
            # Update user
            success = cwa_db.update_user(
                user_id=user_id,
                username=data.get('username'),
                email=data.get('email'),
                kindle_email=data.get('kindle_email'),
                locale=data.get('locale'),
                default_language=data.get('default_language'),
                permissions=data.get('permissions')
            )
            
            if success:
                return jsonify({
                    "success": True,
                    "message": "User updated successfully"
                })
            else:
                return jsonify({"error": "Failed to update user"}), 500
                
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/useradmin/users/<int:user_id>', methods=['DELETE'])
    @app.login_required
    def api_delete_user(user_id: int):
        """Delete a CWA user"""
        try:
            from ...infrastructure.cwa_db_manager import get_cwa_db_manager
            cwa_db = get_cwa_db_manager()
            if not cwa_db:
                return jsonify({"error": "User database not available"}), 503
            
            success = cwa_db.delete_user(user_id)
            
            if success:
                return jsonify({
                    "success": True,
                    "message": "User deleted successfully"
                })
            else:
                return jsonify({"error": "Failed to delete user"}), 500
                
        except Exception as e:
            logger.error(f"Error deleting user: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/books/<int:book_id>', methods=['DELETE'])
    @app.login_required
    def api_admin_delete_book(book_id):
        """Delete a book from the library"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
                
            success, message = db_manager.delete_book(book_id)
            if success:
                return jsonify({'success': True, 'message': message or f'Book {book_id} deleted successfully'})
            else:
                return jsonify({'error': message or 'Failed to delete book'}), 500
                
        except Exception as e:
            logger.error(f"Error deleting book {book_id}: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/admin/books/bulk-delete', methods=['DELETE'])
    @app.admin_required
    def api_admin_bulk_delete_books():
        """Delete multiple books from the library"""
        try:
            data = request.get_json()
            book_ids = data.get('book_ids', [])
            
            if not book_ids:
                return jsonify({'error': 'No book IDs provided'}), 400
                
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
                
            deleted_count = db_manager.bulk_delete_books(book_ids)
            return jsonify({
                'success': True, 
                'message': f'Successfully deleted {deleted_count} books',
                'deleted_count': deleted_count
            })
            
        except Exception as e:
            logger.error(f"Error bulk deleting books: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/admin/duplicates')
    @app.login_required
    def api_admin_duplicates():
        """Find duplicate books in the library"""
        try:
            db_manager = get_calibre_db_manager()
            if not db_manager:
                return jsonify({'error': 'Metadata database not available'}), 503
                
            duplicates = db_manager.find_duplicates()
            return jsonify({'duplicates': duplicates})
            
        except Exception as e:
            logger.error(f"Error finding duplicates: {e}")
            return jsonify({'error': str(e)}), 500
