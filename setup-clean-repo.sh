#!/bin/bash

# Setup Clean Repository and Docker Deployment Script
# This script sets up a clean GitHub repository and prepares for Docker deployment

set -e  # Exit on any error

echo "🚀 Calibre-Web-Automated-Downloader-React - Clean Repository Setup"
echo "=================================================================="

# Configuration
REPO_NAME="Calibre-Web-Automated-Downloader-React"
GITHUB_USERNAME="dgruhin-hrizn"
DOCKER_IMAGE_NAME="cwa-book-downloader"

echo "📋 Configuration:"
echo "  Repository: ${GITHUB_USERNAME}/${REPO_NAME}"
echo "  Docker Image: ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}"
echo ""

# Step 1: Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI found - will create repository automatically"
    USE_GH_CLI=true
else
    echo "⚠️  GitHub CLI not found - you'll need to create the repository manually"
    USE_GH_CLI=false
fi

# Step 2: Create GitHub repository (if GH CLI available)
if [ "$USE_GH_CLI" = true ]; then
    echo ""
    echo "🆕 Creating GitHub repository..."
    
    # Check if already logged in to GitHub CLI
    if ! gh auth status &> /dev/null; then
        echo "🔐 Please log in to GitHub CLI:"
        gh auth login
    fi
    
    # Create the repository
    gh repo create "$REPO_NAME" \
        --public \
        --description "Modern React frontend for Calibre-Web-Automated book downloading with Unraid support" \
        --clone=false
    
    echo "✅ Repository created: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
else
    echo ""
    echo "📝 Manual repository creation required:"
    echo "  1. Go to: https://github.com/new"
    echo "  2. Repository name: ${REPO_NAME}"
    echo "  3. Description: Modern React frontend for Calibre-Web-Automated book downloading with Unraid support"
    echo "  4. Make it PUBLIC"
    echo "  5. Don't initialize with README, .gitignore, or license"
    echo "  6. Click 'Create repository'"
    echo ""
    read -p "Press Enter when you've created the repository..."
fi

# Step 3: Add remote and push
echo ""
echo "🔗 Setting up git remote and pushing code..."

# Remove any existing origin remote
git remote remove origin 2>/dev/null || true

# Add new remote
git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

# Push to new repository
echo "🚀 Pushing clean code to GitHub..."
git push -u origin main

echo "✅ Code pushed to: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"

# Step 4: Update template files with correct repository info
echo ""
echo "📝 Updating template files with correct repository URLs..."

# Update unraid-template.xml
sed -i.bak "s|your-username|${GITHUB_USERNAME}|g" unraid-template.xml
sed -i.bak "s|calibre-web-automated-book-downloader|${REPO_NAME}|g" unraid-template.xml

# Update UNRAID_DEPLOYMENT.md
sed -i.bak "s|your-username|${GITHUB_USERNAME}|g" UNRAID_DEPLOYMENT.md
sed -i.bak "s|calibre-web-automated-book-downloader|${REPO_NAME}|g" UNRAID_DEPLOYMENT.md

# Update deploy-unraid.sh
sed -i.bak "s|your-username|${GITHUB_USERNAME}|g" deploy-unraid.sh
sed -i.bak "s|calibre-web-automated-book-downloader|${REPO_NAME}|g" deploy-unraid.sh

# Remove backup files
rm -f unraid-template.xml.bak UNRAID_DEPLOYMENT.md.bak deploy-unraid.sh.bak

echo "✅ Template files updated with correct URLs"

# Step 5: Commit and push updates
echo ""
echo "💾 Committing template updates..."
git add unraid-template.xml UNRAID_DEPLOYMENT.md deploy-unraid.sh
git commit -m "docs: update template files with correct repository URLs

- Update GitHub repository references to ${GITHUB_USERNAME}/${REPO_NAME}
- Update Docker image references 
- Update all documentation links"

git push origin main

echo "✅ Template updates pushed"

# Step 6: Build and push Docker image
echo ""
echo "🐳 Building and pushing Docker image..."

# Check if user is logged in to GitHub Container Registry
echo "🔐 Logging in to GitHub Container Registry..."
echo "You'll need to provide your GitHub Personal Access Token with packages:write permission"
docker login ghcr.io -u "${GITHUB_USERNAME}"

# Build the Docker image
echo "🏗️  Building Docker image..."
docker build -f Dockerfile.fullstack -t "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest" .

# Tag with version
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker tag "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest" "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:${TIMESTAMP}"

# Push images
echo "📤 Pushing Docker images..."
docker push "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest"
docker push "ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:${TIMESTAMP}"

echo "✅ Docker images pushed:"
echo "  - ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest"
echo "  - ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:${TIMESTAMP}"

# Step 7: Final summary
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📦 Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
echo "🐳 Docker Image: ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}:latest"
echo "📋 Unraid Template: https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/unraid-template.xml"
echo ""
echo "🔧 For Unraid Users:"
echo "1. Add template repository URL to Unraid"
echo "2. Install 'CWA Book Downloader' from Community Applications"
echo "3. Configure your CWA connection settings"
echo "4. Access web interface at: http://YOUR_UNRAID_IP:8084"
echo ""
echo "📚 Documentation:"
echo "  - Unraid Deployment: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/blob/main/UNRAID_DEPLOYMENT.md"
echo "  - Project README: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/blob/main/readme.md"
echo ""
echo "✨ Your clean repository is ready for public use!"
