#!/bin/bash
set -e

echo "Starting Deployment..."

# 1. Fix Permissions
# Ensure we are in the right place or handle directory structure
# This assumes the script is run FROM the inside of games/v1

echo "Fixing permissions..."
# Go up one level to set permissions on the v1 folder
cd ..
if [ -d "v1" ]; then
    sudo chown -R ubuntu:ubuntu v1
else
    echo "Warning: Could not find 'v1' directory to chown. Proceeding..."
fi
cd v1

# 2. Deploy Code
echo "Syncing with GitHub..."

# Check if .git exists
if [ ! -d ".git" ]; then
    echo "Initializing Git..."
    git init
    git remote add origin git@github.com:donsmoore/games-v1.git
fi

# Ensure remote is correct
git remote set-url origin git@github.com:donsmoore/games-v1.git

# Pull
git fetch origin
git reset --hard origin/main

echo "Deployment Complete!"
