#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Configuration
APP_DIR="/opt/research-repo"
SERVICE_NAME="research-repo"

# Stop the service
echo "⏹️ Stopping service..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || echo "Service not running"

# Deploy new version
echo "📁 Deploying files..."
sudo rm -rf $APP_DIR
sudo mkdir -p $APP_DIR
sudo cp -r $GITHUB_WORKSPACE/* $APP_DIR/

# Install dependencies
echo "📦 Installing dependencies..."
cd $APP_DIR/backend
sudo npm ci --production

# Set up environment
echo "⚙️ Setting up environment..."
echo "GEMINI_API_KEY=$GEMINI_API_KEY" | sudo tee $APP_DIR/backend/.env > /dev/null
echo "PORT=3001" | sudo tee -a $APP_DIR/backend/.env > /dev/null

# Set permissions
sudo chown -R www-data:www-data $APP_DIR

# Start service
echo "▶️ Starting service..."
sudo systemctl start $SERVICE_NAME
sudo systemctl enable $SERVICE_NAME

echo "✅ Deployment complete!"