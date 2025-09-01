#!/bin/bash

echo "🛑 Stopping CWA Development Environment"
echo "======================================="

# Check what's running and stop accordingly
if docker-compose -f docker-compose.fulldev.yml ps | grep -q "Up"; then
    echo "🐳 Stopping full Docker development environment..."
    docker-compose -f docker-compose.fulldev.yml down
fi

if docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
    echo "🐳 Stopping hybrid development environment..."
    docker-compose -f docker-compose.dev.yml down
fi

if docker-compose -f docker-compose.simple.yml ps | grep -q "Up"; then
    echo "🐳 Stopping production environment..."
    docker-compose -f docker-compose.simple.yml down
fi

echo ""
echo "✅ All development containers stopped!"
echo ""
echo "🧹 Optional cleanup commands:"
echo "   Remove stopped containers: docker container prune"
echo "   Remove unused images:      docker image prune"
echo "   Remove unused volumes:     docker volume prune"
