#!/bin/bash

echo "🚀 Starting CWA Development Environment"
echo "======================================"

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

# Create local logs directory
mkdir -p logs

echo "🐳 Starting Flask backend in Docker..."
docker-compose -f docker-compose.dev.yml up -d flask-backend

echo "📦 Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "🎨 Starting Vite development server..."
echo ""
echo "✅ Development environment ready!"
echo ""
echo "🌐 Flask Backend: http://localhost:8084"
echo "🎨 Vite Frontend: http://localhost:5173"
echo ""
echo "📝 Backend logs: docker-compose -f docker-compose.dev.yml logs -f flask-backend"
echo "🛑 Stop backend: docker-compose -f docker-compose.dev.yml down"
echo ""
echo "Starting Vite dev server..."

# Start Vite in foreground so you can see the logs
npm run dev
