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
            settings_manager = get_inkdrop_settings_manager()
            
            settings = {
                'conversion': settings_manager.get_conversion_settings(),
                'download': settings_manager.get_download_settings(),
                'smtp': settings_manager.get_smtp_settings(),
                'system': settings_manager.get_system_settings()
            }
            
            return jsonify(settings)
            
        except Exception as e:
            logger.error(f"Error getting admin settings: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/settings', methods=['POST'])
    @app.admin_required
    def api_update_admin_settings():
        """Update global admin settings"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No settings data provided"}), 400
            
            settings_manager = get_inkdrop_settings_manager()
            updated_sections = []
            
            # Update each section if provided
            if 'conversion' in data:
                settings_manager.update_conversion_settings(data['conversion'])
                updated_sections.append('conversion')
                
            if 'download' in data:
                settings_manager.update_download_settings(data['download'])
                updated_sections.append('download')
                
            if 'smtp' in data:
                settings_manager.update_smtp_settings(data['smtp'])
                updated_sections.append('smtp')
            
            return jsonify({
                "success": True,
                "message": f"Updated settings: {', '.join(updated_sections)}"
            })
            
        except Exception as e:
            logger.error(f"Error updating admin settings: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/smtp/settings', methods=['GET'])
    @app.admin_required
    def api_get_smtp_settings():
        """Get SMTP configuration settings"""
        try:
            settings_manager = get_inkdrop_settings_manager()
            smtp_settings = settings_manager.get_smtp_settings()
            
            return jsonify(smtp_settings)
            
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
            settings_manager.update_smtp_settings(data)
            
            return jsonify({"success": True, "message": "SMTP settings updated successfully"})
            
        except Exception as e:
            logger.error(f"Error updating SMTP settings: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/admin/smtp/test', methods=['POST'])
    @app.admin_required
    def api_test_smtp_connection():
        """Test SMTP connection with current settings"""
        try:
            from ...core.kindle_sender import get_kindle_sender
            
            # Get test email from request or use admin's email
            data = request.get_json() or {}
            test_email = data.get('test_email', 'test@example.com')
            
            kindle_sender = get_kindle_sender()
            success = kindle_sender.test_smtp_connection(test_email)
            
            if success:
                return jsonify({"success": True, "message": "SMTP connection test successful"})
            else:
                return jsonify({"error": "SMTP connection test failed"}), 400
                
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
            
            conversion_manager = get_conversion_manager()
            status = conversion_manager.get_status()
            
            return jsonify(status)
            
        except Exception as e:
            logger.error(f"Conversion status error: {e}")
            return jsonify({"error": str(e)}), 500
