# Local Research Repository

AI-powered research repository for storing and searching content with semantic search.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Create environment file:**
```bash
echo 'GEMINI_API_KEY=your_api_key' > /backend/.env
```

## Development

**Start local development:**
```bash
./scripts/dev-local.sh
```
Then open http://localhost:3001 in your browser.

## Deployment

**Deploy for network access:**
```bash
./scripts/deploy.sh
```
This will:
- Auto-detect your local IP
- Update frontend config
- Start production server
- Show you the URL to access from other devices

**Manual deployment:**
```bash
cd backend
NODE_ENV=production npm start
# Then update frontend/config.js with your IP manually
```

## Access URLs

- **Development:** http://localhost:3001
- **Deployment:** http://YOUR_IP:3001 (shown by deploy script)

## Project Structure

```
localServer/
├── backend/           # Node.js server + database
├── frontend/          # HTML/CSS/JS (served by backend)
└── scripts/           # dev-local.sh, deploy.sh
```

## Troubleshooting

**Port in use:** Change PORT in backend/.env file
**Can't access from other devices:** Run ./scripts/deploy.sh or check firewall
**API errors:** Check backend logs and verify Gemini API key in .env
