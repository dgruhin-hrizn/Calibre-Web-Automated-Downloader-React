#!/bin/bash

echo "🐳 Starting Calibre Web Automated Book Downloader in Docker"
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if volumes exist
echo "📁 Checking mounted volumes..."
if [ ! -d "/Volumes/appdata/calibre-web" ]; then
    echo "⚠️  Warning: /Volumes/appdata/calibre-web not found"
    echo "   Make sure your CWA SMB share is mounted"
fi

if [ ! -d "/Volumes/ebook-import" ]; then
    echo "⚠️  Warning: /Volumes/ebook-import not found"  
    echo "   Make sure your ingest SMB share is mounted"
fi

# Create local logs directory
mkdir -p logs

echo "🔨 Building Docker image..."
docker-compose -f docker-compose.simple.yml build

echo "🚀 Starting container..."
docker-compose -f docker-compose.simple.yml up -d

echo ""
echo "✅ Container started!"
echo "📍 Access your app at: http://localhost:8084"
echo ""
echo "📊 Container status:"
docker-compose -f docker-compose.simple.yml ps

echo ""
echo "📝 To view logs:"
echo "   docker-compose -f docker-compose.simple.yml logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose -f docker-compose.simple.yml down"
