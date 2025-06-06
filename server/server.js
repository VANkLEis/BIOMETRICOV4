import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// CORS configuration for Render deployment - UPDATED with new frontend URL
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:5173',
    'https://biometricov4-lunq.onrender.com', // ✅ NEW FRONTEND URL
    'https://biometricov4.onrender.com',
    /\.onrender\.com$/,
    /\.vercel\.app$/,
    /\.netlify\.app$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Socket.IO configuration for secure WebSocket - UPDATED with new frontend URL
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'https://biometricov4-lunq.onrender.com', // ✅ NEW FRONTEND URL
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

// Store room information with enhanced state tracking
const rooms = new Map();
const userStates = new Map(); // Track individual user states

// Socket.IO connection handling with enhanced media request management
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);
  
  // Initialize user state
  userStates.set(socket.id, {
    state: 'connected',
    roomId: null,
    userName: null,
    mediaState: 'none', // none, requesting, ready, error
    lastHeartbeat: Date.now(),
    joinedAt: Date.now()
  });

  // 🔧 ENHANCED: Handle room joining without media requirements
  socket.on('join-room', ({ roomId, userName }) => {
    console.log(`👤 User ${userName} (${socket.id}) joining room ${roomId}`);
    
    // Update user state
    const userState = userStates.get(socket.id);
    userState.roomId = roomId;
    userState.userName = userName;
    userState.state = 'in_room';
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        host: socket.id,
        created: new Date(),
        mediaRequests: new Map() // Track media requests per user
      });
      console.log(`🏠 Created new room: ${roomId}`);
    }

    const room = rooms.get(roomId);
    
    // Prevent duplicate registrations
    if (room.participants.find(p => p.id === socket.id)) {
      console.log(`⚠️ User ${socket.id} already in room ${roomId}, skipping duplicate registration`);
      return;
    }
    
    socket.join(roomId);
    socket.userName = userName;
    socket.roomId = roomId;

    room.participants.push({
      id: socket.id,
      userName: userName,
      joinedAt: new Date(),
      mediaState: 'none'
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
      shouldCreateOffer: false
    });

    console.log(`✅ User ${userName} joined room ${roomId} (${room.participants.length} participants)`);
    console.log(`📊 Room state: ${room.participants.map(p => `${p.userName}(${p.mediaState || 'none'})`).join(', ')}`);
  });

  // Standard WebRTC signaling
  socket.on('offer', ({ offer, roomId }) => {
    console.log(`📤 Relaying offer in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, roomId }) => {
    console.log(`📥 Relaying answer in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    console.log(`🧊 Relaying ICE candidate in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Simple-Peer fallback signaling
  socket.on('simple-peer-signal', ({ signal, roomId }) => {
    console.log(`🔄 Relaying Simple-Peer signal in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('simple-peer-signal', { signal, from: socket.id });
  });

  // Socket.IO streaming fallback
  socket.on('stream-frame', ({ roomId, frame, timestamp }) => {
    console.log(`📺 Relaying stream frame in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('stream-frame', { frame, timestamp, from: socket.id });
  });

  // Media state updates
  socket.on('media-ready', ({ roomId, mediaInfo }) => {
    console.log(`✅ Media ready for ${socket.id} in room ${roomId}`);
    
    const room = rooms.get(roomId);
    if (room) {
      // Update participant state
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.mediaState = 'ready';
        participant.mediaInfo = mediaInfo;
      }
      
      // Notify other participants
      socket.to(roomId).emit('peer-media-ready', {
        userId: socket.id,
        userName: socket.userName,
        mediaInfo: mediaInfo
      });
      
      console.log(`📊 Updated room state: ${room.participants.map(p => `${p.userName}(${p.mediaState})`).join(', ')}`);
    }
  });

  // Enhanced disconnect handling
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    const userState = userStates.get(socket.id);
    
    if (userState && userState.roomId && rooms.has(userState.roomId)) {
      const room = rooms.get(userState.roomId);
      
      // Remove from participants
      room.participants = room.participants.filter(p => p.id !== socket.id);
      
      // Clean up media request tracking
      if (room.mediaRequests.has(socket.id)) {
        room.mediaRequests.delete(socket.id);
      }
      
      // Notify remaining participants
      socket.to(userState.roomId).emit('user-left', {
        userId: socket.id,
        userName: userState.userName,
        participants: room.participants.map(p => p.userName)
      });

      // Clean up empty rooms
      if (room.participants.length === 0) {
        rooms.delete(userState.roomId);
        console.log(`🗑️ Room ${userState.roomId} deleted (empty)`);
      } else {
        console.log(`🏠 Room ${userState.roomId} now has ${room.participants.length} participants`);
      }
    }
    
    // Clean up user state
    userStates.delete(socket.id);
  });

  // Connection diagnostics
  socket.on('ping-test', (data) => {
    socket.emit('pong-test', { 
      ...data, 
      serverTime: Date.now(),
      socketId: socket.id 
    });
  });
});

// Health check endpoint with enhanced room information
app.get('/health', (req, res) => {
  const totalUsers = userStates.size;
  const usersInRooms = Array.from(userStates.values()).filter(u => u.roomId).length;
  const usersWithMedia = Array.from(userStates.values()).filter(u => u.mediaState === 'ready').length;
  
  res.json({ 
    status: 'OK',
    server: 'Enhanced WebRTC Signaling Server',
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    connections: io.engine.clientsCount,
    totalUsers,
    usersInRooms,
    usersWithMedia,
    uptime: process.uptime(),
    features: [
      'webrtc-native',
      'simple-peer-fallback',
      'socket-streaming-fallback',
      'auto-reconnection',
      'connection-diagnostics'
    ]
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
    participantDetails: room.participants.map(p => ({
      userName: p.userName,
      mediaState: p.mediaState,
      joinedAt: p.joinedAt,
      mediaInfo: p.mediaInfo
    })),
    created: room.created,
    host: room.host
  });
});

// Get all rooms
app.get('/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    roomId: id,
    participants: room.participants.length,
    participantsWithMedia: room.participants.filter(p => p.mediaState === 'ready').length,
    created: room.created,
    host: room.host
  }));
  
  res.json({
    totalRooms: rooms.size,
    totalUsers: userStates.size,
    rooms: roomList
  });
});

// Connection test endpoint
app.get('/test-connection', (req, res) => {
  res.json({
    message: 'Server is reachable',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    ip: req.ip || req.connection.remoteAddress
  });
});

server.listen(port, () => {
  console.log(`🛰️ Enhanced WebRTC Signaling Server running on Render`);
  console.log(`📡 Port: ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Secure WebSocket: wss://biometricov4.onrender.com`);
  console.log(`🎥 Features: WebRTC + Simple-Peer + Socket.IO Streaming`);
  console.log(`🔄 Auto-reconnection: Enabled`);
  console.log(`✅ Ready for production deployment`);
  console.log(`🌐 CORS enabled for: biometricov4-lunq.onrender.com`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Enhanced cleanup
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  // Clean up stale user states
  for (const [userId, userState] of userStates.entries()) {
    if (now - userState.lastHeartbeat > staleThreshold) {
      console.log(`🧹 Cleaning up stale user state: ${userId}`);
      userStates.delete(userId);
    }
  }
  
  // Clean up old empty rooms
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.length === 0 && now - room.created.getTime() > 60 * 60 * 1000) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up old empty room: ${roomId}`);
    }
  }
}, 2 * 60 * 1000); // Run every 2 minutes