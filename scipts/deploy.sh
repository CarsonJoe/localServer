#!/bin/bash
set -e                              # Stop if any command fails

echo "🚀 Starting deployment..."

# Configuration
APP_DIR="/opt/research-repo"        # Where app lives on server
SERVICE_NAME="research-repo"        # Name of the system service

# Stop the service
echo "⏹️ Stopping service..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || echo "Service not running"
# This stops your old app so we can replace it

# Deploy new version
echo "📁 Deploying files..."
sudo rm -rf $APP_DIR                # Remove old files
sudo mkdir -p $APP_DIR              # Create fresh directory
sudo cp -r $GITHUB_WORKSPACE/* $APP_DIR/    # Copy new code
# $GITHUB_WORKSPACE is where GitHub puts your code on the server

# Install dependencies
echo "📦 Installing dependencies..."
cd $APP_DIR/backend
sudo npm ci --production            # Install Node.js packages
# This installs packages like express, sqlite3, etc.

# Set up environment
echo "⚙️ Setting up environment..."
echo "GEMINI_API_KEY=$GEMINI_API_KEY" | sudo tee $APP_DIR/backend/.env > /dev/null
echo "PORT=3001" | sudo tee -a $APP_DIR/backend/.env > /dev/null
# This creates the .env file with your API key

# Set permissions
sudo chown -R www-data:www-data $APP_DIR
# Make sure the web server can read the files

# Start service
echo "▶️ Starting service..."
sudo systemctl start $SERVICE_NAME   # Start your new app
sudo systemctl enable $SERVICE_NAME  # Make it auto-start on boot

echo "✅ Deployment complete!"