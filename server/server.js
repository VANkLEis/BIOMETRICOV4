import express from 'express';
import { ExpressPeerServer } from 'peer';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const port = process.env.PORT || 3000;

// Updated CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://localhost:5173',
    'https://secure-call-cmdy.onrender.com',
    /\.onrender\.com$/  // Allow all subdomains on onrender.com
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const server = app.listen(port, () => {
  console.log(`PeerJS server running on port ${port}`);
});

const peerServer = ExpressPeerServer(server, {
  path: '/peerjs',
  allow_discovery: true,
  proxied: true,
  debug: true,
  pingInterval: 3000,
  ssl: false,
  concurrent_limit: 100,
  cleanup_out_msgs: 1000
});

app.use('/', peerServer);

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

// Clear inactive peers periodically
setInterval(() => {
  const clients = peerServer._clients;
  const now = Date.now();
  for (const [id, client] of Object.entries(clients.clients)) {
    if (now - client.getLastPing() > 10000) { // 10 seconds
      client.getSocket()?.close();
      clients.delete(id);
    }
  }
}, 5000);

peerServer.on('connection', (client) => {
  console.log('Client connected:', client.getId());
});

peerServer.on('disconnect', (client) => {
  console.log('Client disconnected:', client.getId());
});