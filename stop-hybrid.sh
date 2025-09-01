#!/bin/bash

echo "🛑 Stopping CWA Hybrid Development Environment"
echo "=============================================="
echo ""

# Stop Docker containers
echo "🐳 Stopping Docker containers..."
docker-compose -f docker-compose.hybrid.yml down

# Find and stop Vite dev server processes
echo ""
echo "🌐 Stopping Vite dev server..."
VITE_PIDS=$(pgrep -f "vite.*dev" || true)

if [ -n "$VITE_PIDS" ]; then
    echo "Found Vite processes: $VITE_PIDS"
    kill $VITE_PIDS 2>/dev/null || true
    echo "✅ Vite dev server stopped"
else
    echo "ℹ️  No Vite dev server processes found"
fi

# Stop any remaining npm processes that might be related
NPM_PIDS=$(pgrep -f "npm.*dev" || true)
if [ -n "$NPM_PIDS" ]; then
    echo "Found npm dev processes: $NPM_PIDS"
    kill $NPM_PIDS 2>/dev/null || true
    echo "✅ npm dev processes stopped"
fi

echo ""
echo "✅ Hybrid development environment stopped!"
echo "   All Docker containers and frontend dev server have been shut down."
