#!/bin/bash

echo "🚀 Starting CWA Hybrid Development Environment"
echo "=============================================="
echo ""
echo "This will start:"
echo "  📚 Official Calibre-Web-Automated (Docker)"
echo "  🔧 Our Flask API (Docker)"
echo "  🌐 React Frontend (Local Vite dev server)"
echo ""
echo "Perfect for frontend development with hot reload!"
echo ""

# Create local directories
mkdir -p ./data ./logs ./ingest ./cwa-data/config ./cwa-data/library

echo "🔨 Building Flask API..."
docker-compose -f docker-compose.hybrid.yml build cwa-downloader-api

echo ""
echo "🚀 Starting backend services..."
docker-compose -f docker-compose.hybrid.yml up -d

echo ""
echo "⏳ Waiting for backend services to start..."
sleep 10

echo ""
echo "✅ Backend services started!"
echo ""
echo "📍 Access points:"
echo "   📚 CWA Web Interface: http://localhost:8083"
echo "   🔧 Flask API: http://localhost:8084"
echo ""
echo "🔑 Default CWA Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 Container status:"
docker-compose -f docker-compose.hybrid.yml ps
echo ""
echo "🌐 Starting React frontend (Vite dev server)..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start Vite dev server in background
echo "🚀 Starting Vite dev server..."
npm run dev &
VITE_PID=$!

# Return to root directory
cd ..

echo ""
echo "✅ Frontend started! PID: $VITE_PID"
echo "   🌐 React App: http://localhost:5173"
echo ""
echo "📝 Useful commands:"
echo "   View all logs:      docker-compose -f docker-compose.hybrid.yml logs -f"
echo "   View CWA logs:      docker-compose -f docker-compose.hybrid.yml logs -f calibre-web-automated"
echo "   View API logs:      docker-compose -f docker-compose.hybrid.yml logs -f cwa-downloader-api"
echo "   Stop backend:       docker-compose -f docker-compose.hybrid.yml down"
echo "   Stop frontend:      kill $VITE_PID"
echo "   Stop everything:    ./stop-hybrid.sh"
echo ""
echo "🎉 Hybrid development environment ready!"
echo "   - CWA and Flask API in Docker with local database access"
echo "   - React frontend running locally with hot reload"
echo ""
echo "📍 All access points:"
echo "   📚 CWA Web Interface: http://localhost:8083"
echo "   🔧 Flask API: http://localhost:8084"
echo "   🌐 React Frontend: http://localhost:5173"
