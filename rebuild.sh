#!/bin/bash

# Rebuild and restart the CWA Downloader containers
# This script stops, rebuilds, and starts the containers

set -e  # Exit on any error

echo "🔄 Starting container rebuild process..."

# Check if docker-compose.hybrid.yml exists
if [ ! -f "docker-compose.hybrid.yml" ]; then
    echo "❌ Error: docker-compose.hybrid.yml not found in current directory"
    exit 1
fi

echo "⏹️  Stopping containers..."
docker-compose -f docker-compose.hybrid.yml down

echo "🏗️  Rebuilding containers..."
docker-compose -f docker-compose.hybrid.yml build --no-cache

echo "🚀 Starting containers..."
docker-compose -f docker-compose.hybrid.yml up -d

echo "📊 Container status:"
docker-compose -f docker-compose.hybrid.yml ps

echo "✅ Rebuild complete!"
echo ""
echo "📋 Useful commands:"
echo "  View logs:     docker-compose -f docker-compose.hybrid.yml logs -f"
echo "  View API logs: docker-compose -f docker-compose.hybrid.yml logs -f cwa-downloader-api"
echo "  View CWA logs: docker-compose -f docker-compose.hybrid.yml logs -f calibre-web-automated"
echo "  Stop all:      docker-compose -f docker-compose.hybrid.yml down"
