# 💧 Inkdrop

![Inkdrop](static/media/droplet.png 'Inkdrop - Modern Digital Library Manager')

A modern, full-featured digital library management system with automated book downloading capabilities. Forked from [Calibre-Web-Automated Book Downloader](https://github.com/crocodilestick/Calibre-Web-Automated) and enhanced with a comprehensive React-based frontend for seamless library management.

## ✨ Features

### 📚 Library Management
- 🎨 Modern React-based frontend with responsive design
- 📖 Comprehensive library browser with grid and list views
- 🔍 Advanced search and filtering capabilities
- 📄 Infinite scroll with intelligent pagination
- 🏷️ Book metadata display and management
- 📊 Library statistics and insights
- 🎯 Smart book recommendations and discovery

### 🔄 Download & Automation
- 🌐 Intuitive book search and download interface
- 🤖 Automated download to specified ingest folder
- 🔌 Seamless integration with Calibre-Web-Automated
- 📖 Support for multiple book formats (epub, mobi, azw3, fb2, djvu, cbz, cbr)
- 🛡️ Cloudflare bypass capability for reliable downloads
- ⚡ Real-time download progress tracking
- 🔄 Automatic library synchronization

### 🎨 User Experience
- 🌙 Dark/light theme support with system preference detection
- 📱 Mobile-first responsive design
- ⚡ Fast, cached browsing with React Query
- 🎭 Smooth animations and transitions
- 🔐 Secure authentication system
- 🚀 Progressive Web App capabilities
- 🐳 Docker-based deployment for quick setup

## 🖼️ Screenshots

### Modern Library Interface
![Library Interface](README_images/inkdrop-library-screenshot.png 'Modern Inkdrop library interface')
*Modern library interface with infinite scroll, search, and responsive grid layout*

### Advanced Book Search
![Book Search](README_images/inkdrop-book-search.png 'Advanced book search and discovery')
*Powerful book search and discovery with filtering capabilities*

### Download Management
![Download Manager](README_images/inkdrop-download-manager.png 'Comprehensive download management')
*Comprehensive download management with queue status and controls*

### Real-time Download Progress
![Download Progress](README_images/inkdrop-downloading-state.png 'Real-time download tracking')
*Real-time download progress tracking with detailed status information*

### Queue Processing
![Queue Management](README_images/inkdrop-queue-processing.png 'Intelligent queue processing')
*Intelligent queue processing with batch operations and status monitoring*

## 🚀 Quick Start

### Prerequisites

- Docker
- Docker Compose
- A running instance of [Calibre-Web-Automated](https://github.com/crocodilestick/Calibre-Web-Automated) (recommended)
- **[FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) Docker container (highly recommended for reliable Cloudflare bypass)**

### Installation Steps

1. Get the docker-compose.yml:

   ```bash
   curl -O https://raw.githubusercontent.com/calibrain/calibre-web-automated-book-downloader/refs/heads/main/docker-compose.yml
   ```

2. Start the service:

   ```bash
   docker compose up -d
   ```

3. Access the web interface at `http://localhost:8084`

## 🛡️ FlareSolverr Setup (Recommended)

For optimal Cloudflare bypass performance and reliability, we highly recommend using FlareSolverr as an external service:

### Quick FlareSolverr Setup

1. **Start FlareSolverr container:**
   ```bash
   docker run -d \
     --name flaresolverr \
     -p 8191:8191 \
     -e LOG_LEVEL=info \
     --restart unless-stopped \
     ghcr.io/flaresolverr/flaresolverr:latest
   ```

2. **Configure Inkdrop to use FlareSolverr:**
   Add these environment variables to your configuration:
   ```bash
   USE_CF_BYPASS=true
   USING_EXTERNAL_BYPASSER=true
   EXT_BYPASSER_URL=http://localhost:8191
   EXT_BYPASSER_PATH=/v1
   EXT_BYPASSER_TIMEOUT=60000
   ```

3. **For Docker Compose setup:**
   ```yaml
   version: '3.8'
   services:
     flaresolverr:
       image: ghcr.io/flaresolverr/flaresolverr:latest
       container_name: flaresolverr
       environment:
         - LOG_LEVEL=info
         - LOG_HTML=false
         - CAPTCHA_SOLVER=none
       ports:
         - "8191:8191"
       restart: unless-stopped

     inkdrop:
       # ... your Inkdrop configuration
       environment:
         - USE_CF_BYPASS=true
         - USING_EXTERNAL_BYPASSER=true
         - EXT_BYPASSER_URL=http://flaresolverr:8191
       depends_on:
         - flaresolverr
   ```

### Benefits of Using FlareSolverr

- ✅ **Superior reliability**: Dedicated Cloudflare bypass service
- ✅ **Better performance**: Optimized for handling anti-bot measures
- ✅ **Resource efficiency**: Reduces load on main application
- ✅ **Shared service**: Can be used by multiple applications
- ✅ **Regular updates**: Actively maintained for latest Cloudflare changes
- ✅ **Proven solution**: Widely used in the community

## ⚙️ Configuration

### Environment Variables

#### Application Settings

| Variable          | Description             | Default Value      |
| ----------------- | ----------------------- | ------------------ |
| `FLASK_PORT`      | Web interface port      | `8084`             |
| `FLASK_HOST`      | Web interface binding   | `0.0.0.0`          |
| `DEBUG`           | Debug mode toggle       | `false`            |
| `INGEST_DIR`      | Book download directory | `/cwa-book-ingest` |
| `TZ`              | Container timezone      | `UTC`              |
| `UID`             | Runtime user ID         | `1000`             |
| `GID`             | Runtime group ID        | `100`              |
| `CWA_DB_PATH`     | Calibre-Web's database  | None               |
| `ENABLE_LOGGING`  | Enable log file         | `true`             |
| `LOG_LEVEL`       | Log level to use        | `info`             |

If you wish to enable authentication, you must set `CWA_DB_PATH` to point to Calibre-Web's `app.db`, in order to match the username and password.

If logging is enabld, log folder default location is `/var/log/cwa-book-downloader`
Available log levels: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. Higher levels show fewer messages.

Note that if using TOR, the TZ will be calculated automatically based on IP.

#### Download Settings

| Variable               | Description                                               | Default Value                     |
| ---------------------- | --------------------------------------------------------- | --------------------------------- |
| `MAX_RETRY`            | Maximum retry attempts                                    | `3`                               |
| `DEFAULT_SLEEP`        | Retry delay (seconds)                                     | `5`                               |
| `MAIN_LOOP_SLEEP_TIME` | Processing loop delay (seconds)                           | `5`                               |
| `SUPPORTED_FORMATS`    | Supported book formats                                    | `epub,mobi,azw3,fb2,djvu,cbz,cbr` |
| `BOOK_LANGUAGE`        | Preferred language for books                              | `en`                              |
| `AA_DONATOR_KEY`       | Optional Donator key for Anna's Archive fast download API | ``                                |
| `USE_BOOK_TITLE`       | Use book title as filename instead of ID                  | `false`                           |
| `PRIORITIZE_WELIB`     | When downloading, download from WELIB first instead of AA | `false`                           |

If you change `BOOK_LANGUAGE`, you can add multiple comma separated languages, such as `en,fr,ru` etc.  

#### AA 

| Variable               | Description                                               | Default Value                     |
| ---------------------- | --------------------------------------------------------- | --------------------------------- |
| `AA_BASE_URL`          | Base URL of Annas-Archive (could be changed for a proxy)  | `https://annas-archive.org`       |
| `USE_CF_BYPASS`        | Enable Cloudflare bypass (required for FlareSolverr)      | `true`                            |
| `USING_EXTERNAL_BYPASSER` | Use external bypasser service (FlareSolverr)           | `false`                           |
| `EXT_BYPASSER_URL`     | FlareSolverr service URL                                   | `http://flaresolverr:8191`        |

**💡 Recommendation**: For optimal performance and reliability, use FlareSolverr as an external bypasser service. See the [FlareSolverr Setup](#️-flaresolverr-setup-recommended) section for configuration details.

If you are a donator on AA, you can use your Key in `AA_DONATOR_KEY` to speed up downloads and bypass the wait times.
If disabling the cloudflare bypass, you will be using alternative download hosts, such as libgen or z-lib, but they usually have a delay before getting the more recent books and their collection is not as big as aa's. But this setting should work for the majority of books.

#### Network Settings

| Variable               | Description                     | Default Value           |
| ---------------------- | ------------------------------- | ----------------------- |
| `AA_ADDITIONAL_URLS`   | Proxy URLs for AA (, separated) | ``                      |
| `HTTP_PROXY`           | HTTP proxy URL                  | ``                      |
| `HTTPS_PROXY`          | HTTPS proxy URL                 | ``                      |
| `CUSTOM_DNS`           | Custom DNS IP                   | ``                      |
| `USE_DOH`              | Use DNS over HTTPS              | `false`                 |

For proxy configuration, you can specify URLs in the following format:
```bash
# Basic proxy
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080

# Proxy with authentication
HTTP_PROXY=http://username:password@proxy.example.com:8080
HTTPS_PROXY=http://username:password@proxy.example.com:8080
```


The `CUSTOM_DNS` setting supports two formats:

1. **Custom DNS Servers**: A comma-separated list of DNS server IP addresses
   - Example: `127.0.0.53,127.0.1.53` (useful for PiHole)
   - Supports both IPv4 and IPv6 addresses in the same string

2. **Preset DNS Providers**: Use one of these predefined options:
   - `google` - Google DNS
   - `quad9` - Quad9 DNS
   - `cloudflare` - Cloudflare DNS
   - `opendns` - OpenDNS

For users experiencing ISP-level website blocks (such as Virgin Media in the UK), using alternative DNS providers like Cloudflare may help bypass these restrictions

If a `CUSTOM_DNS` is specified from the preset providers, you can also set a `USE_DOH=true` to force using DNS over HTTPS,
which might also help in certain network situations. Note that only `google`, `quad9`, `cloudflare` and `opendns` are 
supported for now, and any other value in `CUSTOM_DNS` will make the `USE_DOH` flag ignored.

Try something like this :
```bash
CUSTOM_DNS=cloudflare
USE_DOH=true
```

#### Custom configuration

| Variable               | Description                                                 | Default Value           |
| ---------------------- | ----------------------------------------------------------- | ----------------------- |
| `CUSTOM_SCRIPT`        | Path to an executable script that tuns after each download  | ``                      |

If `CUSTOM_SCRIPT` is set, it will be executed after each successful download but before the file is moved to the ingest directory. This allows for custom processing like format conversion or validation.

The script is called with the full path of the downloaded file as its argument. Important notes:
- The script must preserve the original filename for proper processing
- The file can be modified or even deleted if needed
- The file will be moved to `/cwa-book-ingest` after the script execution (if not deleted)

You can specify these configuration in this format :
```
environment:
  - CUSTOM_SCRIPT=/scripts/process-book.sh

volumes:
  - local/scripts/custom_script.sh:/scripts/process-book.sh
```

### Volume Configuration

```yaml
volumes:
  - /your/local/path:/cwa-book-ingest
  - /cwa/config/path/app.db:/auth/app.db:ro
```
**Note** - If your library volume is on a cifs share, you will get a "database locked" error until you add **nobrl** to your mount line in your fstab file. e.g. //192.168.1.1/Books /media/books cifs credentials=.smbcredentials,uid=1000,gid=1000,iocharset=utf8,**nobrl** - See https://github.com/crocodilestick/Calibre-Web-Automated/issues/64#issuecomment-2712769777

Mount should align with your Calibre-Web-Automated ingest folder.

## Variants:

### 🧅 Tor Variant

This application also offers a variant that routes all its traffic through the Tor network. This can be useful for enhanced privacy or bypassing network restrictions.

To use the Tor variant:

1.  Get the Tor-specific docker-compose file:
    ```bash
    curl -O https://raw.githubusercontent.com/calibrain/calibre-web-automated-book-downloader/refs/heads/main/docker-compose.tor.yml
    ```
2.  Start the service using this file:
    ```bash
    docker compose -f docker-compose.tor.yml up -d
    ```

**Important Considerations for Tor:**

*   **Capabilities:** This variant requires the `NET_ADMIN` and `NET_RAW` Docker capabilities to configure `iptables` for transparent Tor proxying.
*   **Timezone:** When running in Tor mode, the container will attempt to determine the timezone based on the Tor exit node's IP address and set it automatically. This will override the `TZ` environment variable if it is set.
*   **Network Settings:** Custom DNS, DoH, and HTTP(S) proxy settings (`CUSTOM_DNS`, `USE_DOH`, `HTTP_PROXY`, `HTTPS_PROXY`) are ignored when using the Tor variant, as all traffic goes through Tor.

### External Cloudflare Resolver (FlareSolverr Integration)

**⚠️ Note: For new installations, please refer to the [FlareSolverr Setup](#️-flaresolverr-setup-recommended) section above for the recommended approach.**

This section covers the legacy external bypasser variant. The application can use an external service to bypass Cloudflare protection, instead of relying on the built-in bypasser. We strongly recommend [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) as the preferred external resolver, though it's also compatible with services like [ByParr](https://github.com/ThePhaseless/Byparr).

#### How it works:

- When enabled, all requests that require Cloudflare bypass are sent to your external resolver service.
- The application communicates with the resolver using its API.
- This approach can improve reliability and performance, especially if your external resolver is optimized or shared across multiple applications.

#### Configuration

| Variable               | Description                                                 | Default Value           |
| ---------------------- | ----------------------------------------------------------- | ----------------------- |
| `EXT_BYPASSER_URL`     | The full URL of your external resolver (required)           |                         |
| `EXT_BYPASSER_PATH`    | API path for the resolver (usually `/v1`)                   | `/v1`                   |
| `EXT_BYPASSER_TIMEOUT` | Timeout for page loading (in milliseconds)                  | `60000`                 |

#### Important

This feature follows the same configuration of the built-in Cloudflare bypasser, so you should turn on the `USE_CF_BYPASS` configuration to enable it.

#### To use the External Cloudflare resolver variant:

1.  Get the extbp-specific docker-compose file:
    ```bash
    curl -O https://raw.githubusercontent.com/calibrain/calibre-web-automated-book-downloader/refs/heads/main/docker-compose.extbp.yml
    ```
2.  Start the service using this file:
    ```bash
    docker compose -f docker-compose.extbp.yml up -d
    ```

#### Compatibility:
This feature is designed to work with any resolver that implements the `FlareSolverr` API schema, including `ByParr` and similar projects.

#### Benefits:

- Centralizes Cloudflare bypass logic for easier maintenance.
- Can leverage more powerful or distributed resolver infrastructure.
- Reduces load on the main application container.

## 🏗️ Architecture

Inkdrop features a modern full-stack architecture:

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for responsive, utility-first styling
- **Radix UI** for accessible, unstyled components
- **React Query** for intelligent data fetching and caching
- **React Router** for client-side routing with URL state management

### Backend
- **Flask** Python web framework
- **SQLite** database with SQLAlchemy ORM
- **RESTful API** design for frontend-backend communication
- **Authentication** system integrated with Calibre-Web
- **Background task processing** for downloads

### Infrastructure
- **Docker containerization** for consistent deployment
- **Volume mounting** for persistent data and library access
- **Health checks** for service monitoring
- **Logging system** with configurable levels

## 🏥 Health Monitoring

Built-in health checks monitor:

- Web interface availability
- Download service status
- Cloudflare bypass service connection

Checks run every 30 seconds with a 30-second timeout and 3 retries.
You can enable by adding this to your compose :
```
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD pyrequests http://localhost:8084/request/api/status || exit 1
```

## 📝 Logging

Logs are available in:

- Container: `/var/logs/cwa-book-downloader.log`
- Docker logs: Access via `docker logs`

## 🤝 Contributing

Contributions are welcome! Feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Important Disclaimers

### Copyright Notice

While this tool can access various sources including those that might contain copyrighted material (e.g., Anna's Archive), it is designed for legitimate use only. Users are responsible for:

- Ensuring they have the right to download requested materials
- Respecting copyright laws and intellectual property rights
- Using the tool in compliance with their local regulations

### Duplicate Downloads Warning

Please note that the current version:

- Does not check for existing files in the download directory
- Does not verify if books already exist in your Calibre database
- Exercise caution when requesting multiple books to avoid duplicates

## 🙏 Acknowledgments

This project is forked from and builds upon the excellent work of [Calibre-Web-Automated Book Downloader](https://github.com/crocodilestick/Calibre-Web-Automated). We extend our gratitude to the original developers and contributors for creating the foundation that made Inkdrop possible.

### Key Enhancements
- Complete frontend rewrite with modern React architecture
- Enhanced user experience with responsive design
- Advanced library management capabilities
- Improved performance with intelligent caching
- Modern UI/UX with accessibility in mind

## 💬 Support

For issues or questions, please file an issue on the GitHub repository.

## 🔄 Migration from Original

If you're migrating from the original Calibre-Web-Automated Book Downloader, Inkdrop maintains full compatibility with existing configurations and data. Simply update your Docker image and enjoy the enhanced frontend experience!

