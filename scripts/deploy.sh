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

# Start production server
cd backend
echo "🔧 Starting production server..."
echo "📱 Access from any device at: http://$LOCAL_IP:3001"
echo "⚠️  Make sure port 3001 is allowed in your firewall"
NODE_ENV=production npm start
