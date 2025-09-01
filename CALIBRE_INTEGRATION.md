# 📚 CWA Database Integration

This application now supports integration with your existing CWA (Calibre-Web Automated) database to show which books you already have in your library.

## 🔧 Setup

To enable CWA database integration, set the environment variable:

```bash
CWA_DB_PATH=/path/to/your/cwa.db
```

### Docker Setup

Add this to your `docker-compose.yml`:

```yaml
services:
  cwa-book-downloader:
    environment:
      - CWA_DB_PATH=/calibre-web/cwa.db
    volumes:
      - /Volumes/appdata/calibre-web:/calibre-web:ro
```

### Local Setup

```bash
export CWA_DB_PATH="/Volumes/appdata/calibre-web/cwa.db"
```

## ✨ Features

### "In Library" Indicator
- Books already in your Calibre library show a **green checkmark badge** on their cover
- Works in search results and throughout the UI
- Helps prevent duplicate downloads

### Dashboard Status
- Shows Calibre database connection status
- Displays whether the database path is configured
- Green "Connected" when database is found and accessible

### Smart Matching
- Matches books by **title and author** (case-insensitive)
- Uses fuzzy matching with `LIKE` queries for better results
- Handles partial matches to account for slight title variations

## 🔍 How It Works

1. **Database Connection**: Read-only connection to your Calibre SQLite database
2. **Batch Checking**: When you search for books, the app checks all results against your library in one efficient query
3. **Caching**: Results are cached in the frontend to avoid repeated database queries
4. **Visual Indicators**: Books in your library get a distinctive badge

## 📊 API Endpoints

### Check Calibre Status
```http
GET /api/calibre/status
```

Returns:
```json
{
  "available": true,
  "database_path": "/path/to/metadata.db",
  "configured": true
}
```

### Batch Check Books
```http
POST /api/calibre/check
```

Request body:
```json
{
  "books": [
    {"id": "book1", "title": "Book Title", "author": "Author Name"},
    {"id": "book2", "title": "Another Book", "author": "Another Author"}
  ]
}
```

Response:
```json
{
  "exists": {
    "book1": true,
    "book2": false
  }
}
```

## 🛡️ Security & Performance

- **Read-only access**: Only reads from your Calibre database, never writes
- **Connection pooling**: Efficient SQLite connection management
- **Error handling**: Graceful fallback when database is unavailable
- **Batch operations**: Minimizes database queries for better performance

## 🔧 Troubleshooting

### Database Not Found
- Verify the `CWA_DB_PATH` environment variable is set correctly
- Ensure the path points to `metadata.db` (not just the library folder)
- Check file permissions (app needs read access)

### No Matches Found
- Calibre matching is fuzzy but not perfect
- Title/author variations might prevent matches
- Consider the book might be in Calibre under a slightly different title

### Performance Issues
- Large Calibre libraries (>10,000 books) might see slower response times
- Consider using SSD storage for the Calibre database
- Database indexing in Calibre can help performance

## 🚀 Future Enhancements

This is a basic implementation. Potential future features:
- Direct integration with Calibre's content server
- Automatic import of downloaded books into Calibre
- Series and metadata synchronization
- Duplicate detection and management
