#!/bin/bash

echo "🚀 Starting localServer for development..."

cd "$(dirname "$0")/../backend"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run: cp .env.example .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔧 Starting server on localhost:3001..."
echo "📱 Open http://localhost:3001 in your browser"
NODE_ENV=development npm run dev
