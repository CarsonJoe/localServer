#!/bin/bash

echo "🚀 Configuring localServer for production deployment..."

cd "$(dirname "$0")/.."

# Get local IP  
LOCAL_IP=$(hostname -I | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "localhost")

echo "📡 Using IP: $LOCAL_IP"

# Update frontend config for production
cat > frontend/config.js << EOL
// Production frontend configuration
window.APP_CONFIG = {
  API_BASE: 'http://$LOCAL_IP:3001'
};
EOL

echo "✅ Updated frontend config for production"

# Create .env if running in CI and GEMINI_API_KEY is set
cd backend
if [ -n "$GEMINI_API_KEY" ] && [ ! -f ".env" ]; then
    echo "PORT=3001" > .env
    echo "NODE_ENV=production" >> .env
    echo "GEMINI_API_KEY=$GEMINI_API_KEY" >> .env
    echo "✅ Created .env for production"
fi

echo "🚀 Starting server..."
echo "📱 Will be accessible at: http://$LOCAL_IP:3001"

# Start the server (dependencies already installed by CI)
NODE_ENV=production npm start
