#!/bin/bash

# CWA Book Downloader - Unraid Deployment Script
# This script helps deploy the application on Unraid systems

set -e  # Exit on any error

echo "🚀 CWA Book Downloader - Unraid Deployment Setup"
echo "=================================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed or not in PATH"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create directory structure
echo "📁 Creating directory structure..."

# Default Unraid paths - user can modify these
APPDATA_DIR="/mnt/user/appdata/cwa-book-downloader"
CONFIG_DIR="/mnt/user/appdata/calibre-web/config"
LIBRARY_DIR="/mnt/user/media/books/calibre-library"
INGEST_DIR="/mnt/user/media/books/ingest"
LOGS_DIR="$APPDATA_DIR/logs"
DATA_DIR="$APPDATA_DIR/data"

echo "Creating directories:"
echo "  - App data: $APPDATA_DIR"
echo "  - Logs: $LOGS_DIR"
echo "  - Data: $DATA_DIR"

mkdir -p "$APPDATA_DIR"
mkdir -p "$LOGS_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$INGEST_DIR"

# Set permissions
echo "🔒 Setting permissions..."
chmod 755 "$APPDATA_DIR"
chmod 755 "$LOGS_DIR"
chmod 755 "$DATA_DIR"
chmod 755 "$INGEST_DIR"

# Copy environment file if it doesn't exist
if [ ! -f "$APPDATA_DIR/.env" ]; then
    echo "📄 Creating environment configuration..."
    if [ -f "unraid.env.example" ]; then
        cp unraid.env.example "$APPDATA_DIR/.env"
        echo "✅ Environment file created at $APPDATA_DIR/.env"
        echo "⚠️  IMPORTANT: Edit $APPDATA_DIR/.env to configure your settings"
    else
        echo "❌ unraid.env.example not found. Please ensure you're running this from the project directory."
        exit 1
    fi
else
    echo "✅ Environment file already exists at $APPDATA_DIR/.env"
fi

# Copy docker-compose file
if [ -f "docker-compose.unraid.yml" ]; then
    cp docker-compose.unraid.yml "$APPDATA_DIR/docker-compose.yml"
    echo "✅ Docker Compose file copied to $APPDATA_DIR/docker-compose.yml"
else
    echo "❌ docker-compose.unraid.yml not found. Please ensure you're running this from the project directory."
    exit 1
fi

echo ""
echo "🎉 Unraid deployment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit the configuration file: $APPDATA_DIR/.env"
echo "   - Set your CWA_BASE_URL, CWA_USERNAME, and CWA_PASSWORD"
echo "   - Adjust volume paths if needed"
echo "   - Configure other settings as desired"
echo ""
echo "2. Verify your CWA config directory exists and contains app.db:"
echo "   - Config directory: $CONFIG_DIR"
echo "   - Should contain: app.db (for authentication)"
echo ""
echo "3. Verify your Calibre library directory:"
echo "   - Library directory: $LIBRARY_DIR"
echo "   - Should contain: metadata.db and book folders"
echo ""
echo "4. Deploy the container:"
echo "   cd $APPDATA_DIR"
echo "   docker-compose up -d"
echo ""
echo "5. Access the web interface at: http://YOUR_UNRAID_IP:8084"
echo ""
echo "📚 For more information, see the documentation at:"
echo "    https://github.com/dgruhin-hrizn/Calibre-Web-Automated-Downloader-React"
echo ""

# Check if CWA config exists
if [ -d "$CONFIG_DIR" ] && [ -f "$CONFIG_DIR/app.db" ]; then
    echo "✅ CWA config directory found with app.db"
else
    echo "⚠️  WARNING: CWA config directory or app.db not found at $CONFIG_DIR"
    echo "   Make sure Calibre-Web-Automated is properly installed and configured"
fi

# Check if Calibre library exists
if [ -d "$LIBRARY_DIR" ] && [ -f "$LIBRARY_DIR/metadata.db" ]; then
    echo "✅ Calibre library found with metadata.db"
else
    echo "⚠️  WARNING: Calibre library or metadata.db not found at $LIBRARY_DIR"
    echo "   Make sure your Calibre library path is correct"
fi

echo ""
echo "🔧 Troubleshooting tips:"
echo "- If authentication fails, check that CWA_DB_PATH points to the correct app.db file"
echo "- If books don't appear, verify the Calibre library path contains metadata.db"
echo "- If downloads fail, check CWA_BASE_URL and credentials"
echo "- View logs with: docker-compose -f $APPDATA_DIR/docker-compose.yml logs -f"
echo ""
echo "Happy reading! 📖"
