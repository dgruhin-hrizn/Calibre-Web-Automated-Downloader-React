# Rate Limiting Implementation

This document describes the rate limiting implementation added to the CWA Book Downloader to prevent abuse of the hot books and other OPDS endpoints.

## Overview

Rate limiting has been implemented to control the frequency of requests to external CWA instances, particularly for OPDS endpoints that fetch data from external sources. This prevents overloading the external services and ensures fair usage among users.

## Implementation Details

### Rate Limiter Module

**Location**: `src/utils/rate_limiter.py`

The rate limiter provides:
- **Per-user tracking**: Each user (identified by username or IP) has separate rate limits
- **Per-endpoint tracking**: Different endpoints can have different rate limits
- **Thread-safe operations**: Safe for concurrent access in a multi-threaded Flask application
- **Automatic cleanup**: Expired request records are automatically cleaned up
- **Flexible configuration**: Easy to configure limits per endpoint

### Rate Limiting Configuration

Current rate limits applied:

| Endpoint | Limit | Window | Purpose |
|----------|-------|---------|---------|
| `/api/opds/hot` | 10 requests | 60 seconds | Hot books (most restricted) |
| `/api/opds/new` | 15 requests | 60 seconds | New books |
| `/api/opds/discover` | 15 requests | 60 seconds | Random books |
| `/api/opds/rated` | 15 requests | 60 seconds | Rated books |
| `/api/opds/search` | 20 requests | 60 seconds | Search (higher limit for usability) |

### Rate Limiting Headers

When rate limiting is active, the following HTTP headers are included in responses:

- `X-RateLimit-Limit`: Maximum requests allowed in the time window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets
- `Retry-After`: Seconds to wait before retrying (only in 429 responses)

### Error Response Format

When rate limit is exceeded (HTTP 429), the response includes:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 10 requests per 60 seconds",
  "rate_limit": {
    "limit": 10,
    "remaining": 0,
    "reset": 1703123456,
    "reset_in": 45
  }
}
```

## Usage

### Applying Rate Limiting to New Endpoints

To add rate limiting to a new endpoint:

```python
from ...utils.rate_limiter import rate_limit

@app.route('/api/my-endpoint')
@rate_limit(max_requests=15, window_seconds=60, endpoint_name='my_endpoint')
def my_endpoint():
    return jsonify({'data': 'success'})
```

### Monitoring Rate Limiter Status

An admin endpoint is available to monitor rate limiter statistics:

**Endpoint**: `GET /api/admin/rate-limiter/status`

**Response**:
```json
{
  "rate_limiter": {
    "active_users": 3,
    "tracked_endpoints": 8,
    "total_active_requests": 25,
    "last_cleanup": 1703123456.789
  },
  "message": "Rate limiter statistics retrieved successfully"
}
```

## Testing

A test script is provided to verify rate limiting functionality:

```bash
# Run the test script
python test_rate_limiting.py
```

The test script:
- Makes multiple requests to the hot books endpoint
- Verifies that requests are properly rate limited
- Checks rate limiting headers
- Tests the rate limiter status endpoint

## Configuration Options

### Adjusting Rate Limits

To modify rate limits, edit the decorator parameters in `src/integrations/cwa/proxy.py`:

```python
@rate_limit(max_requests=20, window_seconds=120, endpoint_name='opds_hot')
def opds_hot():
    return proxy_opds('hot')
```

### User Identification

The rate limiter identifies users by:
1. **Username** (if logged in): `user:john_doe`
2. **IP Address** (if not logged in): `ip:192.168.1.100`

This ensures that:
- Authenticated users have individual rate limits
- Anonymous users are rate limited by IP address
- Users can't bypass limits by logging out

## Performance Considerations

### Memory Usage

The rate limiter stores request timestamps in memory:
- **Typical usage**: ~100 bytes per active user per endpoint
- **Cleanup interval**: Every 5 minutes
- **Automatic expiration**: Old records are automatically removed

### Thread Safety

All operations are thread-safe using Python's `threading.Lock()`:
- Multiple requests can be processed concurrently
- Rate limit checks are atomic
- No race conditions in request counting

## Security Considerations

### Protection Against Abuse

Rate limiting helps protect against:
- **API abuse**: Prevents excessive requests from single users
- **DoS attacks**: Limits impact of malicious traffic
- **Resource exhaustion**: Prevents overloading external CWA instances

### Bypass Prevention

The implementation prevents common bypass attempts:
- **IP-based tracking**: Anonymous users can't bypass by refreshing
- **Session-based tracking**: Authenticated users tracked by username
- **Per-endpoint limits**: Can't exhaust one endpoint to affect others

## Troubleshooting

### Common Issues

1. **Rate limits too restrictive**:
   - Increase `max_requests` parameter
   - Increase `window_seconds` for longer windows

2. **Rate limits not working**:
   - Check that the decorator is applied to the route
   - Verify imports are correct
   - Check server logs for errors

3. **Memory usage concerns**:
   - Monitor using the status endpoint
   - Adjust cleanup interval if needed
   - Consider reducing window_seconds for faster cleanup

### Debug Information

Enable debug logging to see rate limiter activity:

```python
import logging
logging.getLogger('src.utils.rate_limiter').setLevel(logging.DEBUG)
```

## Future Enhancements

Potential improvements:
- **Redis backend**: For distributed deployments
- **Dynamic limits**: Adjust limits based on server load
- **Whitelist support**: Exclude certain users from rate limiting
- **Metrics integration**: Export metrics to monitoring systems
