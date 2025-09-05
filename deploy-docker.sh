#!/bin/bash

# Docker Deployment Script for Inkdrop Book Downloader
# This script handles just the Docker image building and deployment

set -e  # Exit on any error

echo "🐳 Inkdrop Book Downloader - Docker Deployment"
echo "=============================================="

# Configuration
GITHUB_USERNAME="dgruhin-hrizn"
DOCKER_IMAGE_NAME="inkdrop"
REPO_NAME="inkdrop"

echo "📋 Configuration:"
echo "  Docker Image: ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}"
echo "  Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
echo ""

# Step 1: Login to GitHub Container Registry
echo "🔐 Logging in to GitHub Container Registry..."
echo "You'll need a GitHub Personal Access Token with 'write:packages' permission"
echo "Get one at: https://github.com/settings/tokens"
echo ""

docker login ghcr.io -u "${GITHUB_USERNAME}"

if [ $? -ne 0 ]; then
    echo "❌ Login failed. Please check your token has 'write:packages' permission"
    exit 1
fi

echo "✅ Login successful"

# Step 2: Build the Docker image
echo ""
echo "🏗️  Building Docker image..."
docker build -f Dockerfile.fullstack -t "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest" .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker image built successfully"

# Step 3: Tag with timestamp version
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker tag "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest" "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:${TIMESTAMP}"

echo "✅ Tagged with version: ${TIMESTAMP}"

# Step 4: Push images
echo ""
echo "📤 Pushing Docker images to GitHub Container Registry..."

docker push "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest"
if [ $? -ne 0 ]; then
    echo "❌ Failed to push latest tag"
    exit 1
fi

docker push "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:${TIMESTAMP}"
if [ $? -ne 0 ]; then
    echo "❌ Failed to push timestamped tag"
    exit 1
fi

echo "✅ Docker images pushed successfully!"

# Step 5: Final summary
echo ""
echo "🎉 Docker Deployment Complete!"
echo "=============================="
echo ""
echo "📦 Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
echo "🐳 Docker Images:"
echo "  - ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest"
echo "  - ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:${TIMESTAMP}"
echo ""
echo "📋 Unraid Template URL:"
echo "  https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/unraid-template.xml"
echo ""
echo "🔧 For Unraid Users:"
echo "1. Add the template URL to your Unraid Community Applications"
echo "2. Install 'Inkdrop' from templates"
echo "3. Configure your library and data paths"
echo "4. Access at: http://YOUR_UNRAID_IP:8084"
echo ""
echo "✨ Your application is now ready for deployment!"
