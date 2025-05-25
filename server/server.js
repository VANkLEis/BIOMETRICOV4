import express from 'express';
import { ExpressPeerServer } from 'peer';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

const server = app.listen(port, () => {
  console.log(`PeerJS server running on port ${port}`);
});

const peerServer = ExpressPeerServer(server, {
  path: '/peerjs',
  allow_discovery: true,
  proxied: true,
  debug: true,
  pingInterval: 5000,
});

app.use('/', peerServer);

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

peerServer.on('connection', (client) => {
  console.log('Client connected:', client.getId());
});

peerServer.on('disconnect', (client) => {
  console.log('Client disconnected:', client.getId());
});