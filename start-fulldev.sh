#!/bin/bash

echo "🐳 Starting CWA Full Docker Development Environment"
echo "================================================="

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

echo "🔨 Building Flask backend image..."
docker-compose -f docker-compose.fulldev.yml build flask-backend

echo "🚀 Starting full development environment..."
echo "   - Flask backend with hot reload"
echo "   - Vite frontend with hot reload"
echo ""

# Start in detached mode first to show status
docker-compose -f docker-compose.fulldev.yml up -d

echo ""
echo "✅ Development environment started!"
echo ""
echo "📍 Access points:"
echo "   🌐 Frontend (Vite): http://localhost:5173"
echo "   🔧 Backend (Flask): http://localhost:8084"
echo "   📊 API Health: http://localhost:8084/api/status"
echo ""
echo "📊 Container status:"
docker-compose -f docker-compose.fulldev.yml ps

echo ""
echo "🔄 Hot reload enabled for:"
echo "   ✅ React files in ./frontend/src/"
echo "   ✅ Flask files in ./"
echo ""
echo "📝 Useful commands:"
echo "   View all logs:      docker-compose -f docker-compose.fulldev.yml logs -f"
echo "   View Flask logs:    docker-compose -f docker-compose.fulldev.yml logs -f flask-backend"
echo "   View Vite logs:     docker-compose -f docker-compose.fulldev.yml logs -f vite-frontend"
echo "   Restart services:   docker-compose -f docker-compose.fulldev.yml restart"
echo "   Stop everything:    docker-compose -f docker-compose.fulldev.yml down"
echo ""
echo "🎨 Happy coding! Both frontend and backend will auto-reload on changes."
echo ""

# Ask if user wants to follow logs
read -p "📋 Follow logs now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 Following logs (Ctrl+C to stop watching)..."
    docker-compose -f docker-compose.fulldev.yml logs -f
fi
