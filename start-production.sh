#!/bin/bash

echo "🚀 Starting CWA Production Environment"
echo "======================================"
echo ""
echo "This will start:"
echo "  📚 Official Calibre-Web-Automated (latest)"
echo "  🔧 Our Flask API with modern features"
echo "  🌐 React Frontend with hot book search"
echo "  🌍 Nginx reverse proxy"
echo ""
echo "All with local database access - no SMB issues!"
echo ""

# Create local directories for development
mkdir -p ./data ./logs ./ingest

# Build and start all services
echo "🔨 Building our Flask API..."
docker-compose -f docker-compose.production.yml build cwa-downloader-api

echo ""
echo "🚀 Starting all services..."
docker-compose -f docker-compose.production.yml up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "✅ CWA Production environment started!"
echo ""
echo "📍 Access points:"
echo "   🌐 Modern Frontend: http://localhost"
echo "   📚 CWA Web Interface: http://localhost/cwa/"
echo "   🔧 API: http://localhost/api/status"
echo "   📖 OPDS: http://localhost/opds/"
echo ""
echo "📊 Container status:"
docker-compose -f docker-compose.production.yml ps
echo ""
echo "📝 Useful commands:"
echo "   View all logs:      docker-compose -f docker-compose.production.yml logs -f"
echo "   View CWA logs:      docker-compose -f docker-compose.production.yml logs -f calibre-web-automated"
echo "   View API logs:      docker-compose -f docker-compose.production.yml logs -f cwa-downloader-api"
echo "   Stop everything:    docker-compose -f docker-compose.production.yml down"
echo "   Restart:            docker-compose -f docker-compose.production.yml restart"
echo ""
echo "🎉 Your production CWA environment is ready!"
echo "   - Official CWA for proven library management"
echo "   - Modern React frontend for enhanced UX"
echo "   - Local database access (no SMB issues)"
echo "   - All features working together!"
