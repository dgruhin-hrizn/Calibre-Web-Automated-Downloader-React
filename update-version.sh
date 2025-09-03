#!/bin/bash

# Standalone version update script
# Usage: ./update-version.sh [version]
# Example: ./update-version.sh 1.4.0

set -e

VERSION_FILE="frontend/src/version.ts"

# Function to print colored output
print_status() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

show_usage() {
    echo "Version Update Script"
    echo ""
    echo "Usage: $0 [VERSION]"
    echo ""
    echo "Arguments:"
    echo "  VERSION     Version number to set (e.g., 1.4.0, 2.0.0-beta.1)"
    echo ""
    echo "Examples:"
    echo "  $0 1.4.0"
    echo "  $0 2.0.0-beta.1"
    echo ""
    echo "This script updates the version displayed in the frontend UI."
}

# Parse arguments
if [[ $# -eq 0 ]]; then
    print_error "No version specified"
    show_usage
    exit 1
fi

if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_usage
    exit 0
fi

VERSION="$1"

# Validate version format (basic check)
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    print_error "Invalid version format: $VERSION"
    echo "Expected format: X.Y.Z or X.Y.Z-suffix (e.g., 1.4.0, 2.0.0-beta.1)"
    exit 1
fi

# Update version file
print_status "Updating version to $VERSION..."

# Create or update the version file
cat > "$VERSION_FILE" << EOF
// Auto-generated version file - DO NOT EDIT MANUALLY
// This file is automatically updated by the build scripts
export const APP_VERSION = '$VERSION'
EOF

if [[ -f "$VERSION_FILE" ]]; then
    print_success "Version updated successfully: $VERSION_FILE"
    print_status "New version: $VERSION"
else
    print_error "Failed to create version file: $VERSION_FILE"
    exit 1
fi

echo ""
echo "✅ Version update complete!"
echo "   The frontend will now display: Inkdrop v$VERSION"
echo ""
echo "💡 To build with this version:"
echo "   ./build-multiarch.sh $VERSION --latest --push"
