#!/usr/bin/env python3
"""
Test CWA proxy directly without Flask routes
"""

import sys
sys.path.append('.')

from cwa_proxy import CWAProxy
import logging

# Enable debug logging
logging.basicConfig(level=logging.INFO)

def test_cwa_direct():
    print("🔍 Direct CWA Proxy Test")
    print("=" * 25)
    
    # Create CWA proxy
    print("1. Creating CWA proxy...")
    proxy = CWAProxy("http://192.168.1.8:8083")
    print(f"   Proxy created: ✅")
    
    # Test connection
    print("2. Testing connection...")
    connected = proxy.test_connection()
    print(f"   Connection: {'✅' if connected else '❌'}")
    
    if not connected:
        print("   Cannot proceed without connection")
        return
    
    # Try to create user session directly
    print("3. Creating user session...")
    try:
        user_session = proxy._get_user_session("admin", "PRotected!21KEepout!99")
        print(f"   User session: {'✅' if user_session else '❌'}")
        if user_session:
            print(f"   Username: {user_session.username}")
            print(f"   Logged in: {user_session.logged_in}")
            print(f"   Has CSRF: {bool(user_session.csrf_token)}")
        
        print(f"   Active sessions: {len(proxy.user_sessions)}")
        
    except Exception as e:
        print(f"   Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_cwa_direct()
