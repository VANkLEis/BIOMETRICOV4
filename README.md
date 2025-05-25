# SecureCall - Video Call Application

A secure video calling application built with React, Vite, and PeerJS.

## Project Structure

```
/
├── client/          # Frontend React application
└── server/          # PeerJS signaling server
```

## Local Development

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the PeerJS server:
```bash
npm run dev
```

The PeerJS server will be running at `http://localhost:3000`

## Deployment

### Frontend Deployment

The frontend can be deployed to any static hosting service (Netlify, Vercel, etc.).

1. Build the frontend:
```bash
npm run build
```

2. Deploy the `dist` directory

### Backend Deployment (Render.com)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - `PORT`: 3000

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_PEER_HOST=localhost
VITE_PEER_PORT=3000
VITE_PEER_PATH=/peerjs
VITE_PEER_SECURE=false
```

For production, update the values in `.env.production`:

```env
VITE_PEER_HOST=your-app.onrender.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/peerjs
VITE_PEER_SECURE=true
```

## Testing

1. For local testing between devices on the same network:
   - Use the local IP address of your computer
   - Both devices must be on the same network
   - Access via `http://local-ip:5173`

2. For testing with external devices:
   - Deploy the backend to Render.com
   - Update the frontend environment variables
   - Deploy the frontend
   - Access via HTTPS

## Important Notes

- WebRTC requires HTTPS in production
- Local development can use HTTP
- Mobile devices require HTTPS unless using localhost
- The PeerJS server must be running for video calls to work