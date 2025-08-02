#!/bin/bash

echo "🚀 Deploying localServer for network access..."

cd "$(dirname "$0")/.."

# Get local IP
LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "Unable to detect IP")

if [ "$LOCAL_IP" = "Unable to detect IP" ]; then
    echo "❌ Could not detect local IP. Please find your IP manually:"
    echo "   ip addr show | grep 'inet.*scope global'"
    exit 1
fi

echo "📡 Detected local IP: $LOCAL_IP"

# Update frontend config for deployment
cat > frontend/config.js << EOL
// Production frontend configuration
window.APP_CONFIG = {
  API_BASE: 'http://$LOCAL_IP:3001'
};
EOL

echo "✅ Updated frontend config for deployment"

# Kill any existing process using port 3001
echo "🧹 Checking for existing process on port 3001..."
if lsof -i :3001 &>/dev/null; then
  echo "⚠️ Port 3001 is in use. Killing process..."
  lsof -ti :3001 | xargs kill -9
else
  echo "✅ Port 3001 is free."
fi

# Start production server
cd backend
echo "🔧 Starting production server..."
echo "📱 Access from any device at: http://$LOCAL_IP:3001"
echo "⚠️  Make sure port 3001 is allowed in your firewall"
NODE_ENV=production npm start

