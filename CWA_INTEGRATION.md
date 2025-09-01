# CWA Integration Guide

This guide explains how to integrate your book downloader with an existing **Calibre-Web-Automated (CWA)** instance to provide full library management capabilities.

## 🎯 **What This Integration Provides**

### **New Features:**
- **📚 Library Browser**: Browse your entire Calibre library with modern UI
- **🔍 Library Search**: Search books, authors, series in your existing library  
- **📖 Web Reader**: Read books directly in the browser via CWA's reader
- **⬇️ Direct Downloads**: Download books in multiple formats from your library
- **📊 Library Stats**: View library statistics on the dashboard
- **🔗 Unified Experience**: Seamless integration between downloading and library management

### **Architecture:**
```
┌─────────────────────────────────────────┐
│           React Frontend                │
│    (Your Modern Radix UI Interface)    │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────────┐    ┌─────────────────┐
│ Downloader  │    │ Existing CWA    │
│ Backend     │    │ Instance        │
│ (Port 8084) │    │ (Port 8083)     │
└─────────────┘    └─────────────────┘
```

---

## 🚀 **Quick Setup**

### **1. Environment Variables**

Add these environment variables to configure CWA integration:

```bash
# CWA Integration Settings
CWA_BASE_URL=http://localhost:8083    # Your CWA instance URL
CWA_USERNAME=admin                    # CWA username (optional for public instances)
CWA_PASSWORD=admin123                 # CWA password (optional for public instances)
```

### **2. Docker Compose Example**

If you're running both services with Docker Compose:

```yaml
version: '3.8'
services:
  # Your existing CWA service
  calibre-web-automated:
    image: crocodilestick/calibre-web-automated:latest
    container_name: calibre-web-automated
    ports:
      - "8083:8083"
    volumes:
      - /path/to/config:/config
      - /path/to/calibre-library:/calibre-library
      - /path/to/ingest:/cwa-book-ingest
    environment:
      - PUID=1000
      - PGID=1000
    restart: unless-stopped

  # Your book downloader service
  book-downloader:
    build: .
    container_name: book-downloader
    ports:
      - "8084:8084"
    volumes:
      - /path/to/config:/config
    environment:
      - CWA_BASE_URL=http://calibre-web-automated:8083
      - CWA_USERNAME=admin
      - CWA_PASSWORD=admin123
      - CWA_DB_PATH=/config/cwa.db  # For download tracking
    depends_on:
      - calibre-web-automated
    restart: unless-stopped
```

### **3. Verify Connection**

1. **Start both services**
2. **Open your React frontend** (usually `http://localhost:5173`)
3. **Check the Dashboard** - you should see a "Library Status" widget
4. **Navigate to Library** - new menu item in the sidebar

---

## 🔧 **Configuration Options**

### **CWA Instance Settings**

| Variable | Default | Description |
|----------|---------|-------------|
| `CWA_BASE_URL` | `http://localhost:8083` | URL of your CWA instance |
| `CWA_USERNAME` | `""` | CWA username (leave empty for anonymous access) |
| `CWA_PASSWORD` | `""` | CWA password (leave empty for anonymous access) |

### **Authentication Options**

- **Anonymous Access**: Leave username/password empty if CWA allows anonymous browsing
- **User Authentication**: Set username/password for authenticated access
- **Session Sharing**: The integration handles authentication automatically

---

## 📱 **Using the Integration**

### **Library Page Features**

#### **📚 Browse Books**
- **Grid/List View**: Toggle between visual grid and detailed list views
- **Sorting**: Sort by newest, oldest, A-Z, Z-A
- **Pagination**: Navigate through large libraries efficiently
- **Book Cards**: Show cover, title, author, series, available formats

#### **🔍 Search Library**
- **Full-text Search**: Search titles, authors, series, descriptions
- **Real-time Results**: Instant search results as you type
- **Search History**: Previous searches are cached
- **Clear Filters**: Easy reset to browse all books

#### **📖 Reading & Downloads**
- **Web Reader**: Read books directly in browser (EPUB, PDF support)
- **Multiple Formats**: Download in EPUB, MOBI, AZW3, PDF, etc.
- **Direct Download**: One-click downloads with proper filenames
- **Format Selection**: Choose preferred format for reading/downloading

### **Dashboard Integration**

The Dashboard now shows:
- **Library Status**: Connection status to your CWA instance
- **Library Stats**: Total books, recent additions
- **Recent Activity**: Both downloads and library additions

---

## 🔍 **API Endpoints**

The integration adds these new API endpoints to your backend:

### **Status & Connection**
```bash
GET /api/cwa/status              # Check CWA connection status
```

### **Library Browsing**
```bash
GET /api/cwa/books               # Get books with pagination
GET /api/cwa/search              # Search library books
GET /api/cwa/authors             # Get all authors
GET /api/cwa/series              # Get all series
GET /api/cwa/categories          # Get all categories/tags
```

### **Book Details**
```bash
GET /api/cwa/book/{id}           # Get book details
GET /api/cwa/book/{id}/formats   # Get available formats
GET /api/cwa/book/{id}/cover     # Get cover image URL
GET /api/cwa/book/{id}/reader    # Get web reader URL
```

### **Downloads**
```bash
GET /api/cwa/book/{id}/download/{format}  # Download book file
```

---

## 🛠️ **Troubleshooting**

### **Connection Issues**

**Problem**: "Unable to connect to CWA library"
```bash
# Check CWA is running
curl http://localhost:8083

# Check from your app container
docker exec -it book-downloader curl http://calibre-web-automated:8083
```

**Solution**: 
- Verify CWA is running and accessible
- Check `CWA_BASE_URL` is correct
- Ensure network connectivity between containers

### **Authentication Issues**

**Problem**: "Authentication failed"
```bash
# Test login manually
curl -X POST http://localhost:8083/login \
  -d "username=admin&password=admin123&submit=Sign in"
```

**Solution**:
- Verify `CWA_USERNAME` and `CWA_PASSWORD` are correct
- Check CWA user management settings
- Try anonymous access (leave credentials empty)

### **Empty Library**

**Problem**: "No books found"
- Check CWA library path is correctly mounted
- Verify Calibre `metadata.db` exists and is readable
- Check CWA logs for library scanning issues

### **Reader Issues**

**Problem**: Web reader not opening
- Ensure CWA reader is enabled in settings
- Check book format compatibility (EPUB works best)
- Verify popup blockers aren't preventing new windows

---

## 📈 **Performance Considerations**

### **Caching Strategy**
- **Book Lists**: Cached for 1 minute
- **Book Details**: Cached for 5 minutes  
- **Cover Images**: Cached for 1 hour
- **Search Results**: Cached per query

### **Optimization Tips**
- Use pagination for large libraries (25-50 books per page)
- Enable CWA's cover thumbnail generation
- Consider CDN for cover images in production

---

## 🔄 **Future Enhancements**

Potential future integrations:

### **Advanced Features**
- **Reading Progress Sync**: Sync reading progress with KOReader
- **Collections Management**: Create and manage custom book collections
- **Metadata Editing**: Edit book information directly from the interface
- **Format Conversion**: Convert books between formats
- **OPDS Catalog**: Expose library via OPDS for e-reader apps

### **Import Integration**
- **Automatic Import**: Downloaded books auto-import to CWA
- **Duplicate Detection**: Prevent duplicate books in library
- **Metadata Enhancement**: Auto-fetch metadata for imported books

---

## 🆘 **Support**

### **Logs**
Check logs for integration issues:
```bash
# Your app logs
docker logs book-downloader

# CWA logs  
docker logs calibre-web-automated
```

### **Common Log Messages**
- `"Successfully authenticated with CWA"` ✅ - Connection working
- `"CWA authentication failed"` ❌ - Check credentials
- `"Unable to connect to CWA library"` ❌ - Check URL/network

### **Debug Mode**
Enable debug logging:
```bash
DEBUG=true
LOG_LEVEL=DEBUG
```

---

## 📝 **Notes**

- **Non-Breaking**: This integration doesn't affect existing functionality
- **Optional**: CWA integration is completely optional - app works fine without it
- **Backwards Compatible**: All existing features continue to work normally
- **Performance**: Minimal impact on app performance when CWA is unavailable

The integration provides a seamless bridge between your modern download interface and the full power of Calibre-Web-Automated's library management system!

