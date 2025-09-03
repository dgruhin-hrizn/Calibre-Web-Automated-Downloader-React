# CWA Downloader Session Architecture Documentation

## Overview
The CWA Downloader implements a **dual session cookie system** to handle authentication for both the main application and CWA proxy functionality. This document explains the architecture, implementation, and reasoning behind this approach.

## Historical Context

### Original Problem (Commit 91d9b22)
The original implementation accidentally created two session cookies due to **duplicate Flask session configuration**:

```python
# First configuration
app.config['SESSION_COOKIE_NAME'] = 'cwa_downloader_session'
app.config['SECRET_KEY'] = 'static-key'

# Second configuration (overwrote the first)
app.config.update(
    SECRET_KEY = os.urandom(64),  # Different secret key!
    # No SESSION_COOKIE_NAME specified - used Flask default
)
```

**Result:** Two cookies were created accidentally:
- `cwa_downloader_session` (from first config)  
- `session` (Flask default from second config)

### The Fix
We intentionally implemented **proper dual session cookies** with meaningful names and controlled behavior.

## Current Architecture

### Two Session Cookies

#### 1. `cwa_app_session` (Primary Flask Session)
- **Purpose:** Main application authentication and session management
- **Managed by:** Flask's built-in session system
- **Configuration:**
  ```python
  app.config['SESSION_COOKIE_NAME'] = 'cwa_app_session'
  app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'fallback-key')
  ```
- **Contains:**
  - `logged_in: True/False`
  - `username: <user>`
  - `cwa_password: <password>`
  - Standard Flask session data
- **Used by:**
  - All Flask routes that use `session.get()`
  - Authentication decorators (`@login_required`)
  - CWA proxy routes (via `_get_current_user_credentials()`)

#### 2. `cwa_proxy_session` (Secondary Custom Session)
- **Purpose:** Additional session data for custom functionality
- **Managed by:** Custom `DualSessionApp` class
- **Configuration:**
  ```python
  proxy_session_config = {
      'SECRET_KEY': os.urandom(32),  # Different secret key
      'SESSION_COOKIE_NAME': 'cwa_proxy_session'
  }
  ```
- **Contains:**
  - `username: <user>`
  - `cwa_password: <password>`
  - `logged_in: True`
  - `session_type: 'cwa_proxy'`
- **Used by:**
  - Custom functionality that needs separate session context
  - Available for manual access when needed

## Implementation Details

### Session Creation (Login)

```python
@app.route('/api/login', methods=['POST'])
def api_login():
    # ... authentication logic ...
    
    if authentication_successful:
        # 1. Create primary Flask session (cwa_app_session)
        session['logged_in'] = True
        session['username'] = username
        session['cwa_password'] = password
        session.permanent = True
        
        # 2. Create secondary session cookie (cwa_proxy_session)
        response = jsonify({"success": True, "user": {"username": username}})
        dual_session_manager.create_proxy_session_cookie(response, username, password)
        
        return response
```

### Session Destruction (Logout)

```python
@app.route('/api/logout', methods=['POST'])
def api_logout():
    # 1. Clear primary Flask session
    session.clear()  # Automatically clears cwa_app_session
    
    # 2. Manually clear secondary session cookie
    response = jsonify({"success": True})
    response.set_cookie('cwa_proxy_session', '', expires=0)
    
    return response
```

### How Proxy Routes Access Sessions

All CWA proxy routes automatically use the **primary Flask session** (`cwa_app_session`):

```python
def _get_current_user_credentials(self):
    """Get current user credentials from Flask session"""
    username = session.get('username')      # From cwa_app_session
    password = session.get('cwa_password')  # From cwa_app_session
    return username, password
```

## Key Points for Developers

### ✅ What Works Automatically
- **All existing code** continues to work unchanged
- **Proxy routes** automatically use `cwa_app_session`
- **Authentication decorators** work with `cwa_app_session`
- **Login/logout** manages both cookies together

### 🔧 Manual Access to Secondary Cookie
If you need to access the `cwa_proxy_session` cookie manually:

```python
from itsdangerous import URLSafeTimedSerializer
from flask import request

def get_proxy_session_data():
    """Manually decode the proxy session cookie"""
    cookie_value = request.cookies.get('cwa_proxy_session')
    if not cookie_value:
        return None
        
    serializer = URLSafeTimedSerializer(dual_session_manager.proxy_session_config['SECRET_KEY'])
    try:
        return serializer.loads(cookie_value)
    except:
        return None
```

### 🚨 Important Considerations

1. **Different Secret Keys:** Each cookie uses a different secret key for security isolation
2. **Synchronized Lifecycle:** Both cookies are created/destroyed together
3. **Primary vs Secondary:** Flask automatically handles `cwa_app_session`, `cwa_proxy_session` requires manual management
4. **Backward Compatibility:** All existing session-based code works unchanged

## Browser Cookie Behavior

When a user logs in, they will see **two cookies** in their browser:

```
cwa_app_session=eyJ1c2VybmFtZSI6InRlc3QiLCJsb2dnZWRfaW4iOnRydWV9...
cwa_proxy_session=eyJ1c2VybmFtZSI6InRlc3QiLCJzZXNzaW9uX3R5cGUiOiJjd2FfcHJveHkifQ...
```

Both cookies:
- Have the same security settings (HttpOnly, SameSite, etc.)
- Expire at the same time (24 hours)
- Are cleared together on logout

## Troubleshooting

### "No credentials found in session" errors
- Check that `cwa_app_session` cookie exists and is valid
- Verify Flask session configuration is correct
- Ensure login process completed successfully

### Missing secondary cookie
- Check that `dual_session_manager.create_proxy_session_cookie()` is called during login
- Verify response object is returned properly from login endpoint

### Session persistence issues
- Check `session.permanent = True` is set during login
- Verify `PERMANENT_SESSION_LIFETIME` configuration
- Ensure secret keys are consistent across app restarts (use environment variables)

## Migration Notes

### From Accidental Dual Cookies (Pre-Fix)
- Old cookies: `cwa_downloader_session` + `session`
- New cookies: `cwa_app_session` + `cwa_proxy_session`
- **Action Required:** Users need to log in again after upgrade

### Future Changes
If modifying session behavior:
1. Update both cookie creation and destruction logic
2. Test that proxy routes still work
3. Verify authentication decorators function correctly
4. Update this documentation

---

**Last Updated:** January 2025  
**Related Files:**
- `src/api/app.py` - Main session configuration and dual cookie implementation
- `src/integrations/cwa/proxy.py` - Proxy route session access
- This documentation file

**Key Classes:**
- `DualSessionApp` - Manages secondary cookie creation/destruction
- `CWAProxy._get_current_user_credentials()` - Accesses primary session data
