#!/bin/bash

# Multi-Architecture Docker Build Script for CWA Book Downloader
# Usage: ./build-multiarch.sh [version] [--latest] [--push]
# Example: ./build-multiarch.sh 1.2.0 --latest --push

set -e  # Exit on any error

# Configuration
GITHUB_USERNAME="dgruhin-hrizn"
DOCKER_IMAGE_NAME="calibre-web-automated-downloader-react"
DOCKERFILE="Dockerfile.fullstack"
PLATFORMS="linux/amd64,linux/arm64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Multi-Architecture Docker Build Script"
    echo ""
    echo "Usage: $0 [VERSION] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  VERSION     Semantic version number (e.g., 1.2.0, 2.0.0-beta.1)"
    echo "              If not provided, will use timestamp format"
    echo ""
    echo "Options:"
    echo "  --latest    Also tag as 'latest'"
    echo "  --push      Push images to registry (default: build only)"
    echo "  --dry-run   Show what would be built without actually building"
    echo "  --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 1.2.0                    # Build version 1.2.0 only"
    echo "  $0 1.2.0 --latest          # Build 1.2.0 and tag as latest"
    echo "  $0 1.2.0 --latest --push   # Build, tag as latest, and push"
    echo "  $0 --latest --push          # Build with timestamp, tag as latest, and push"
    echo "  $0 --dry-run 1.2.0 --latest # Show what would be built"
    echo ""
    echo "Platforms: ${PLATFORMS}"
    echo "Registry: ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}"
}

# Parse command line arguments
VERSION=""
TAG_LATEST=false
PUSH=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --latest)
            TAG_LATEST=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        -*)
            print_error "Unknown option $1"
            show_usage
            exit 1
            ;;
        *)
            if [[ -z "$VERSION" ]]; then
                VERSION="$1"
            else
                print_error "Multiple version arguments provided: $VERSION and $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Generate version if not provided
if [[ -z "$VERSION" ]]; then
    VERSION=$(date +%Y%m%d-%H%M%S)
    print_warning "No version specified, using timestamp: $VERSION"
fi

# Validate version format (basic semver check)
if [[ ! "$VERSION" =~ ^[0-9]{8}-[0-9]{6}$ ]] && [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    print_warning "Version '$VERSION' doesn't follow semantic versioning or timestamp format"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build image name and tags
BASE_IMAGE="ghcr.io/${GITHUB_USERNAME}/${DOCKER_IMAGE_NAME}"
VERSION_TAG="${BASE_IMAGE}:${VERSION}"
TAGS=("-t" "$VERSION_TAG")

if [[ "$TAG_LATEST" == true ]]; then
    LATEST_TAG="${BASE_IMAGE}:latest"
    TAGS+=("-t" "$LATEST_TAG")
fi

# Display build configuration
echo "🐳 Multi-Architecture Docker Build Configuration"
echo "=================================================="
echo "Image Base:    $BASE_IMAGE"
echo "Version:       $VERSION"
echo "Tag Latest:    $TAG_LATEST"
echo "Push:          $PUSH"
echo "Platforms:     $PLATFORMS"
echo "Dockerfile:    $DOCKERFILE"
echo ""
echo "Tags to build:"
for i in $(seq 1 2 ${#TAGS[@]}); do
    echo "  - ${TAGS[$i]}"
done
echo ""

# Dry run mode
if [[ "$DRY_RUN" == true ]]; then
    print_warning "DRY RUN MODE - No actual build will be performed"
    echo ""
    echo "Would execute:"
    echo "docker buildx build \\"
    echo "  --platform $PLATFORMS \\"
    echo "  -f $DOCKERFILE \\"
    for tag in "${TAGS[@]}"; do
        echo "  $tag \\"
    done
    if [[ "$PUSH" == true ]]; then
        echo "  --push \\"
    fi
    echo "  ."
    exit 0
fi

# Check if buildx is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! docker buildx version &> /dev/null; then
    print_error "Docker Buildx is not available"
    exit 1
fi

# Setup buildx builder
print_status "Setting up multi-architecture builder..."

BUILDER_NAME="multiarch"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    print_status "Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name "$BUILDER_NAME" --use
else
    print_status "Using existing buildx builder: $BUILDER_NAME"
    docker buildx use "$BUILDER_NAME"
fi

# Bootstrap the builder
print_status "Bootstrapping builder..."
docker buildx inspect --bootstrap

# Check if we need to login for push
if [[ "$PUSH" == true ]]; then
    print_status "Checking GitHub Container Registry authentication..."
    
    # Simply check if ghcr.io exists in Docker config - if not, prompt for login
    if ! grep -q "ghcr.io" ~/.docker/config.json 2>/dev/null; then
        print_warning "Not logged in to GitHub Container Registry"
        echo "Please login with: docker login ghcr.io -u $GITHUB_USERNAME"
        read -p "Continue with login now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker login ghcr.io -u "$GITHUB_USERNAME"
        else
            print_error "Cannot push without authentication"
            exit 1
        fi
    else
        print_status "Found GitHub Container Registry credentials"
    fi
fi

# Build the image
print_status "Building multi-architecture Docker image..."
echo "Platforms: $PLATFORMS"

BUILD_ARGS=(
    "buildx" "build"
    "--platform" "$PLATFORMS"
    "-f" "$DOCKERFILE"
)

# Add tags
BUILD_ARGS+=("${TAGS[@]}")

# Add push flag if requested
if [[ "$PUSH" == true ]]; then
    BUILD_ARGS+=("--push")
    print_status "Images will be pushed to registry"
else
    print_warning "Images will be built locally only (use --push to upload)"
fi

# Add build context
BUILD_ARGS+=(".")

# Execute the build
echo ""
print_status "Executing build command..."
echo "docker ${BUILD_ARGS[*]}"
echo ""

if docker "${BUILD_ARGS[@]}"; then
    print_success "Multi-architecture build completed successfully!"
    echo ""
    echo "Built images:"
    for i in $(seq 1 2 ${#TAGS[@]}); do
        echo "  ✅ ${TAGS[$i]}"
    done
    
    if [[ "$PUSH" == true ]]; then
        echo ""
        print_success "Images pushed to GitHub Container Registry!"
        echo ""
        echo "🚀 Ready for deployment:"
        echo "  Docker Pull: docker pull $VERSION_TAG"
        if [[ "$TAG_LATEST" == true ]]; then
            echo "  Latest:      docker pull $LATEST_TAG"
        fi
        echo ""
        echo "📋 Unraid Template URL:"
        echo "  https://raw.githubusercontent.com/${GITHUB_USERNAME}/Calibre-Web-Automated-Downloader-React/main/unraid-template.xml"
    else
        echo ""
        print_warning "Images built locally only. Use --push to upload to registry."
        echo "To push manually:"
        for i in $(seq 1 2 ${#TAGS[@]}); do
            echo "  docker push ${TAGS[$i]}"
        done
    fi
    
    echo ""
    print_success "Build process completed! 🎉"
    
else
    print_error "Build failed!"
    exit 1
fi
