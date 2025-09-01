#!/bin/bash

echo "🚀 Starting CWA Simple Environment"
echo "=================================="
echo ""
echo "This will start:"
echo "  📚 Official Calibre-Web-Automated"
echo "  🔧 Our Flask API + React Frontend"
echo ""
echo "Direct access, no reverse proxy - perfect for development!"
echo ""

# Create local directories
mkdir -p ./data ./logs ./ingest ./cwa-data/config ./cwa-data/library

echo "🔨 Building our Flask API..."
docker-compose -f docker-compose.simple.yml build cwa-downloader-api

echo ""
echo "🚀 Starting both services..."
docker-compose -f docker-compose.simple.yml up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 15

echo ""
echo "✅ Simple CWA environment started!"
echo ""
echo "📍 Access points:"
echo "   📚 CWA Web Interface: http://localhost:8083"
echo "   🔧 Our Modern API: http://localhost:8084"
echo "   🌐 Our React Frontend: http://localhost:8084 (when built)"
echo ""
echo "🔑 Default CWA Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 Container status:"
docker-compose -f docker-compose.simple.yml ps
echo ""
echo "📝 Useful commands:"
echo "   View all logs:      docker-compose -f docker-compose.simple.yml logs -f"
echo "   View CWA logs:      docker-compose -f docker-compose.simple.yml logs -f calibre-web-automated"
echo "   View API logs:      docker-compose -f docker-compose.simple.yml logs -f cwa-downloader-api"
echo "   Stop everything:    docker-compose -f docker-compose.simple.yml down"
echo ""
echo "🎉 Ready to go! Both CWA and our API have local database access!"
