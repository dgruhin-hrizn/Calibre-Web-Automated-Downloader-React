"""
Kindle Email Sender - Direct Send to Kindle functionality
Uses SMTP settings from app.db to send books via email
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from pathlib import Path
from typing import Optional, Dict, Any
import os
import mimetypes

from ..infrastructure.inkdrop_settings_manager import get_inkdrop_settings_manager, SMTPSettings
from ..infrastructure.cwa_db_manager import get_cwa_db_manager

logger = logging.getLogger(__name__)

class KindleSender:
    """Handles sending books to Kindle devices via email"""
    
    def __init__(self):
        self.settings_manager = get_inkdrop_settings_manager()
        self.cwa_db = get_cwa_db_manager()
    
    def get_user_kindle_email(self, username: str) -> Optional[str]:
        """Get user's Kindle email from app.db"""
        if not self.cwa_db:
            logger.error("CWA database not available")
            return None
        
        try:
            user_info = self.cwa_db.get_user_by_username(username)
            if user_info:
                kindle_email = user_info.get('kindle_email', '').strip()
                if kindle_email:
                    return kindle_email
                else:
                    logger.warning(f"No Kindle email configured for user: {username}")
            else:
                logger.error(f"User not found: {username}")
        except Exception as e:
            logger.error(f"Error getting Kindle email for {username}: {e}")
        
        return None
    
    def validate_smtp_settings(self, smtp_settings: SMTPSettings) -> bool:
        """Validate SMTP settings are complete"""
        required_fields = ['mail_server', 'mail_from']
        
        for field in required_fields:
            if not getattr(smtp_settings, field):
                logger.error(f"SMTP setting '{field}' is required but not configured")
                return False
        
        if smtp_settings.mail_port <= 0 or smtp_settings.mail_port > 65535:
            logger.error(f"Invalid SMTP port: {smtp_settings.mail_port}")
            return False
        
        return True
    
    def create_email_message(self, smtp_settings: SMTPSettings, to_email: str, 
                           book_title: str, book_path: Path, 
                           user_message: str = "") -> MIMEMultipart:
        """Create email message with book attachment"""
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_settings.mail_from
        msg['To'] = to_email
        msg['Subject'] = f"Book: {book_title}"
        
        # Email body
        body_text = f"""
Your book "{book_title}" is attached.

{user_message}

Sent via Inkdrop Book Downloader
""".strip()
        
        msg.attach(MIMEText(body_text, 'plain'))
        
        # Attach book file
        if book_path.exists():
            file_size = book_path.stat().st_size
            
            # Check file size limit (default 25MB for most email providers)
            max_size = smtp_settings.mail_size or 26214400  # 25MB
            if file_size > max_size:
                raise ValueError(f"Book file too large ({file_size} bytes > {max_size} bytes)")
            
            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(str(book_path))
            if mime_type is None:
                mime_type = 'application/octet-stream'
            
            # Attach file
            with open(book_path, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
            
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {book_path.name}'
            )
            
            msg.attach(part)
            logger.info(f"Attached book: {book_path.name} ({file_size} bytes)")
        else:
            raise FileNotFoundError(f"Book file not found: {book_path}")
        
        return msg
    
    def send_email(self, smtp_settings: SMTPSettings, message: MIMEMultipart) -> bool:
        """Send email via SMTP"""
        try:
            # Create SMTP connection
            if smtp_settings.mail_use_ssl:
                server = smtplib.SMTP_SSL(smtp_settings.mail_server, smtp_settings.mail_port)
            else:
                server = smtplib.SMTP(smtp_settings.mail_server, smtp_settings.mail_port)
                if smtp_settings.mail_port == 587:  # Common TLS port
                    server.starttls()
            
            # Login if credentials provided
            if smtp_settings.mail_login and smtp_settings.mail_password:
                server.login(smtp_settings.mail_login, smtp_settings.mail_password)
            
            # Send email
            text = message.as_string()
            server.sendmail(smtp_settings.mail_from, message['To'], text)
            server.quit()
            
            logger.info(f"Email sent successfully to {message['To']}")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            return False
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"SMTP recipient refused: {e}")
            return False
        except smtplib.SMTPServerDisconnected as e:
            logger.error(f"SMTP server disconnected: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    def send_book_to_kindle(self, username: str, book_path: Path, 
                          book_title: str, user_message: str = "") -> Dict[str, Any]:
        """
        Send a book to user's Kindle device
        
        Args:
            username: Username to get Kindle email for
            book_path: Path to book file
            book_title: Title of the book
            user_message: Optional message to include in email
            
        Returns:
            Dict with success status and message
        """
        try:
            # Get user's Kindle email
            kindle_email = self.get_user_kindle_email(username)
            if not kindle_email:
                return {
                    'success': False,
                    'error': 'No Kindle email configured for user'
                }
            
            # Get SMTP settings
            smtp_settings = self.settings_manager.get_smtp_settings()
            if not self.validate_smtp_settings(smtp_settings):
                return {
                    'success': False,
                    'error': 'SMTP settings not properly configured'
                }
            
            # Create and send email
            message = self.create_email_message(
                smtp_settings, kindle_email, book_title, book_path, user_message
            )
            
            if self.send_email(smtp_settings, message):
                return {
                    'success': True,
                    'message': f'Book "{book_title}" sent to {kindle_email}',
                    'kindle_email': kindle_email
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to send email'
                }
                
        except ValueError as e:
            return {
                'success': False,
                'error': str(e)
            }
        except FileNotFoundError as e:
            return {
                'success': False,
                'error': f'Book file not found: {book_path}'
            }
        except Exception as e:
            logger.error(f"Unexpected error sending book to Kindle: {e}")
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}'
            }
    
    def test_smtp_connection(self) -> Dict[str, Any]:
        """Test SMTP connection with current settings"""
        try:
            smtp_settings = self.settings_manager.get_smtp_settings()
            
            if not self.validate_smtp_settings(smtp_settings):
                return {
                    'success': False,
                    'error': 'SMTP settings validation failed'
                }
            
            # Test connection
            if smtp_settings.mail_use_ssl:
                server = smtplib.SMTP_SSL(smtp_settings.mail_server, smtp_settings.mail_port)
            else:
                server = smtplib.SMTP(smtp_settings.mail_server, smtp_settings.mail_port)
                if smtp_settings.mail_port == 587:
                    server.starttls()
            
            # Test login if credentials provided
            if smtp_settings.mail_login and smtp_settings.mail_password:
                server.login(smtp_settings.mail_login, smtp_settings.mail_password)
            
            server.quit()
            
            return {
                'success': True,
                'message': f'SMTP connection successful to {smtp_settings.mail_server}:{smtp_settings.mail_port}',
                'server': smtp_settings.mail_server,
                'port': smtp_settings.mail_port,
                'ssl': smtp_settings.mail_use_ssl
            }
            
        except Exception as e:
            logger.error(f"SMTP connection test failed: {e}")
            return {
                'success': False,
                'error': f'SMTP connection failed: {str(e)}'
            }
    
    def send_test_email(self, test_email: str) -> Dict[str, Any]:
        """Send a test email to verify SMTP settings"""
        try:
            smtp_settings = self.settings_manager.get_smtp_settings()
            
            if not self.validate_smtp_settings(smtp_settings):
                return {
                    'success': False,
                    'error': 'SMTP settings validation failed'
                }
            
            # Create test email message
            msg = MIMEMultipart()
            msg['From'] = smtp_settings.mail_from
            msg['To'] = test_email
            msg['Subject'] = 'Inkdrop SMTP Test Email'
            
            # Email body
            body = """
This is a test email from your Inkdrop Book Downloader application.

If you receive this email, your SMTP settings are configured correctly!

Server: {}
Port: {}
Security: {}
            """.format(
                smtp_settings.mail_server,
                smtp_settings.mail_port,
                "SSL/TLS" if smtp_settings.mail_use_ssl else "STARTTLS"
            )
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Send the email
            if self.send_email(smtp_settings, msg):
                return {
                    'success': True,
                    'message': f'Test email sent successfully to {test_email}',
                    'recipient': test_email
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to send test email'
                }
                
        except Exception as e:
            logger.error(f"Test email sending failed: {e}")
            return {
                'success': False,
                'error': f'Test email failed: {str(e)}'
            }

# Global instance
_kindle_sender: Optional[KindleSender] = None

def get_kindle_sender() -> KindleSender:
    """Get the global Kindle sender instance"""
    global _kindle_sender
    if _kindle_sender is None:
        _kindle_sender = KindleSender()
    return _kindle_sender
