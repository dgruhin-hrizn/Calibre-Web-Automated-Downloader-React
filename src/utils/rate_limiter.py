#!/usr/bin/env python3
"""
Rate Limiter Utility for CWA Book Downloader
Provides rate limiting functionality for API endpoints
"""

import time
import threading
from functools import wraps
from typing import Dict, Optional, Tuple
from flask import request, jsonify, session
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """Thread-safe rate limiter with per-user tracking"""
    
    def __init__(self):
        self._requests: Dict[str, Dict[str, list]] = {}  # {user_id: {endpoint: [timestamps]}}
        self._lock = threading.Lock()
        self._cleanup_interval = 300  # 5 minutes
        self._last_cleanup = time.time()
    
    def _get_user_key(self) -> str:
        """Get unique user identifier from session"""
        # Use username if available, otherwise fall back to IP
        username = session.get('username')
        if username:
            return f"user:{username}"
        return f"ip:{request.remote_addr}"
    
    def _cleanup_expired_requests(self, current_time: float, window_seconds: int):
        """Remove expired request timestamps"""
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        
        cutoff_time = current_time - window_seconds
        
        with self._lock:
            for user_id in list(self._requests.keys()):
                user_requests = self._requests[user_id]
                for endpoint in list(user_requests.keys()):
                    # Remove expired timestamps
                    user_requests[endpoint] = [
                        timestamp for timestamp in user_requests[endpoint]
                        if timestamp > cutoff_time
                    ]
                    # Remove empty endpoint entries
                    if not user_requests[endpoint]:
                        del user_requests[endpoint]
                
                # Remove empty user entries
                if not user_requests:
                    del self._requests[user_id]
        
        self._last_cleanup = current_time
        logger.debug(f"Rate limiter cleanup completed. Active users: {len(self._requests)}")
    
    def is_rate_limited(self, endpoint: str, max_requests: int, window_seconds: int) -> Tuple[bool, Dict]:
        """
        Check if request should be rate limited
        
        Args:
            endpoint: API endpoint identifier
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds
            
        Returns:
            Tuple of (is_limited, rate_limit_info)
        """
        current_time = time.time()
        user_key = self._get_user_key()
        
        # Cleanup expired entries periodically
        self._cleanup_expired_requests(current_time, window_seconds)
        
        with self._lock:
            # Initialize user tracking if needed
            if user_key not in self._requests:
                self._requests[user_key] = {}
            
            if endpoint not in self._requests[user_key]:
                self._requests[user_key][endpoint] = []
            
            # Get current request timestamps for this user/endpoint
            timestamps = self._requests[user_key][endpoint]
            
            # Remove expired timestamps
            cutoff_time = current_time - window_seconds
            timestamps[:] = [t for t in timestamps if t > cutoff_time]
            
            # Check if rate limit exceeded
            if len(timestamps) >= max_requests:
                # Find when the oldest request will expire
                oldest_timestamp = min(timestamps)
                reset_time = oldest_timestamp + window_seconds
                
                rate_limit_info = {
                    'limit': max_requests,
                    'remaining': 0,
                    'reset': int(reset_time),
                    'reset_in': int(reset_time - current_time),
                    'window': window_seconds
                }
                
                logger.warning(
                    f"Rate limit exceeded for {user_key} on {endpoint}: "
                    f"{len(timestamps)}/{max_requests} requests in {window_seconds}s window"
                )
                
                return True, rate_limit_info
            
            # Add current request timestamp
            timestamps.append(current_time)
            
            # Calculate remaining requests
            remaining = max_requests - len(timestamps)
            
            rate_limit_info = {
                'limit': max_requests,
                'remaining': remaining,
                'reset': int(current_time + window_seconds),
                'reset_in': window_seconds,
                'window': window_seconds
            }
            
            return False, rate_limit_info
    
    def get_stats(self) -> Dict:
        """Get rate limiter statistics"""
        with self._lock:
            total_users = len(self._requests)
            total_endpoints = sum(len(endpoints) for endpoints in self._requests.values())
            total_requests = sum(
                len(timestamps) 
                for user_requests in self._requests.values()
                for timestamps in user_requests.values()
            )
            
            return {
                'active_users': total_users,
                'tracked_endpoints': total_endpoints,
                'total_active_requests': total_requests,
                'last_cleanup': self._last_cleanup
            }

# Global rate limiter instance
_rate_limiter = RateLimiter()

def rate_limit(max_requests: int, window_seconds: int, endpoint_name: Optional[str] = None):
    """
    Decorator to apply rate limiting to Flask routes
    
    Args:
        max_requests: Maximum number of requests allowed
        window_seconds: Time window in seconds
        endpoint_name: Custom endpoint identifier (defaults to route path)
    
    Example:
        @rate_limit(max_requests=10, window_seconds=60)  # 10 requests per minute
        def my_api_endpoint():
            return jsonify({'data': 'success'})
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Use custom endpoint name or derive from request path
            endpoint = endpoint_name or request.endpoint or request.path
            
            # Check rate limit
            is_limited, rate_info = _rate_limiter.is_rate_limited(
                endpoint, max_requests, window_seconds
            )
            
            if is_limited:
                # Return rate limit exceeded response
                response = jsonify({
                    'error': 'Rate limit exceeded',
                    'message': f'Too many requests. Limit: {rate_info["limit"]} requests per {rate_info["window"]} seconds',
                    'rate_limit': {
                        'limit': rate_info['limit'],
                        'remaining': rate_info['remaining'],
                        'reset': rate_info['reset'],
                        'reset_in': rate_info['reset_in']
                    }
                })
                response.status_code = 429
                
                # Add rate limit headers
                response.headers['X-RateLimit-Limit'] = str(rate_info['limit'])
                response.headers['X-RateLimit-Remaining'] = str(rate_info['remaining'])
                response.headers['X-RateLimit-Reset'] = str(rate_info['reset'])
                response.headers['Retry-After'] = str(rate_info['reset_in'])
                
                return response
            
            # Execute the original function
            response = func(*args, **kwargs)
            
            # Add rate limit headers to successful responses
            if hasattr(response, 'headers'):
                response.headers['X-RateLimit-Limit'] = str(rate_info['limit'])
                response.headers['X-RateLimit-Remaining'] = str(rate_info['remaining'])
                response.headers['X-RateLimit-Reset'] = str(rate_info['reset'])
            
            return response
        
        return wrapper
    return decorator

def get_rate_limiter_stats() -> Dict:
    """Get rate limiter statistics"""
    return _rate_limiter.get_stats()

def clear_rate_limiter():
    """Clear all rate limiter data (for testing)"""
    global _rate_limiter
    _rate_limiter = RateLimiter()
