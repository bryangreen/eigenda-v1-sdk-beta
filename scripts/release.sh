#!/bin/bash

# Ensure we're in a clean state
if [[ -n $(git status -s) ]]; then
  echo "Error: Working directory is not clean. Please commit or stash changes first."
  exit 1
fi

# Get current version from package.json
current_version=$(node -p "require('./package.json').version")
echo "Current version: $current_version"

# Ask for new version
read -p "Enter new version (current is $current_version): " new_version

# Validate version format
if ! [[ $new_version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
  echo "Error: Version must be in format x.y.z or x.y.z-tag"
  exit 1
fi

# Update version in package.json
npm version $new_version -m "Release v%s"

# Push changes and tags
git push origin master
git push origin v$new_version

echo "Release v$new_version initiated!"
echo "GitHub Actions will now:"
echo "1. Run tests"
echo "2. Create a GitHub release"
echo "3. Publish to npm" 