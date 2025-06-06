import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// CORS configuration for Render deployment
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://localhost:5173',
    'https://biometricov4.onrender.com',
    /\.onrender\.com$/,
    /\.vercel\.app$/,
    /\.netlify\.app$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Socket.IO configuration for secure WebSocket
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://localhost:5173',
      'https://biometricov4.onrender.com',
      /\.onrender\.com$/,
      /\.vercel\.app$/,
      /\.netlify\.app$/
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowEIO3: true
});

// Store room information
const rooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  socket.on('join-room', ({ roomId, userName }) => {
    console.log(`👤 User ${userName} (${socket.id}) joining room ${roomId}`);
    
    socket.join(roomId);
    socket.userName = userName;
    socket.roomId = roomId;

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        host: socket.id,
        created: new Date()
      });
    }

    const room = rooms.get(roomId);
    room.participants.push({
      id: socket.id,
      userName: userName,
      joinedAt: new Date()
    });

    // Notify existing participants about new user
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userName: userName,
      participants: room.participants.map(p => p.userName),
      shouldCreateOffer: false
    });

    // Notify the new user about existing participants
    socket.emit('user-joined', {
      userId: socket.id,
      userName: userName,
      participants: room.participants.map(p => p.userName),
      shouldCreateOffer: room.participants.length > 1
    });

    console.log(`🏠 Room ${roomId} now has ${room.participants.length} participants`);
  });

  socket.on('offer', ({ offer, roomId }) => {
    console.log(`📤 Relaying offer in room ${roomId}`);
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, roomId }) => {
    console.log(`📥 Relaying answer in room ${roomId}`);
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    console.log(`🧊 Relaying ICE candidate in room ${roomId}`);
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.participants = room.participants.filter(p => p.id !== socket.id);
      
      // Notify remaining participants
      socket.to(socket.roomId).emit('user-left', {
        userId: socket.id,
        userName: socket.userName,
        participants: room.participants.map(p => p.userName)
      });

      // Clean up empty rooms
      if (room.participants.length === 0) {
        rooms.delete(socket.roomId);
        console.log(`🗑️ Room ${socket.roomId} deleted (empty)`);
      } else {
        console.log(`🏠 Room ${socket.roomId} now has ${room.participants.length} participants`);
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    server: 'Render WebRTC Signaling Server',
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    connections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

// Get room info endpoint
app.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId,
    participants: room.participants.length,
    participantNames: room.participants.map(p => p.userName),
    created: room.created,
    host: room.host
  });
});

// Get all rooms (for debugging)
app.get('/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    roomId: id,
    participants: room.participants.length,
    created: room.created,
    host: room.host
  }));
  
  res.json({
    totalRooms: rooms.size,
    rooms: roomList
  });
});

server.listen(port, () => {
  console.log(`🛰️ WebRTC Signaling Server running on Render`);
  console.log(`📡 Port: ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Secure WebSocket: wss://biometricov4.onrender.com`);
  console.log(`🌐 STUN: Google (stun.l.google.com:19302)`);
  console.log(`🔁 TURN: OpenRelay (openrelay.metered.ca)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Clean up old rooms periodically (every 30 minutes)
setInterval(() => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.length === 0 && room.created < oneHourAgo) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up old empty room: ${roomId}`);
    }
  }
}, 30 * 60 * 1000);