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

    // Notify existing participants about new user (WITHOUT requiring media)
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userName: userName,
      participants: room.participants.map(p => p.userName),
      shouldCreateOffer: false // Don't create offer until both have media
    });

    // Notify the new user about existing participants
    socket.emit('user-joined', {
      userId: socket.id,
      userName: userName,
      participants: room.participants.map(p => p.userName),
      shouldCreateOffer: false // Will be handled after media is ready
    });

    console.log(`✅ User ${userName} joined room ${roomId} (${room.participants.length} participants)`);
    console.log(`📊 Room state: ${room.participants.map(p => `${p.userName}(${p.mediaState || 'none'})`).join(', ')}`);
  });

  // 🔧 NEW: Handle media request started (pause timeouts, start heartbeats)
  socket.on('media-request-started', ({ roomId, timestamp }) => {
    console.log(`🎥 Media request started by ${socket.id} in room ${roomId}`);
    
    const userState = userStates.get(socket.id);
    const room = rooms.get(roomId);
    
    if (userState && room) {
      userState.mediaState = 'requesting';
      userState.mediaRequestStarted = timestamp;
      
      // Track in room
      room.mediaRequests.set(socket.id, {
        startTime: timestamp,
        state: 'requesting',
        heartbeats: 0
      });
      
      // Update participant state
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.mediaState = 'requesting';
      }
      
      // Acknowledge the request
      socket.emit('media-request-acknowledged', { 
        roomId, 
        timestamp: Date.now(),
        timeout: 30000 // 30 second timeout
      });
      
      console.log(`📝 Media request acknowledged for ${socket.id}`);
    }
  });

  // 🔧 NEW: Handle media heartbeats (keep connection alive during permission request)
  socket.on('media-heartbeat', ({ roomId, state, timestamp }) => {
    const userState = userStates.get(socket.id);
    const room = rooms.get(roomId);
    
    if (userState && room && room.mediaRequests.has(socket.id)) {
      userState.lastHeartbeat = timestamp;
      
      const mediaRequest = room.mediaRequests.get(socket.id);
      mediaRequest.heartbeats++;
      mediaRequest.lastHeartbeat = timestamp;
      
      console.log(`💓 Media heartbeat from ${socket.id} (#${mediaRequest.heartbeats})`);
      
      // Respond to heartbeat to confirm server is alive
      socket.emit('media-heartbeat-ack', { 
        timestamp: Date.now(),
        heartbeatCount: mediaRequest.heartbeats
      });
    }
  });

  // 🔧 NEW: Handle successful media acquisition
  socket.on('media-ready', ({ roomId, mediaInfo, timestamp }) => {
    console.log(`✅ Media ready for ${socket.id} in room ${roomId}:`, mediaInfo);
    
    const userState = userStates.get(socket.id);
    const room = rooms.get(roomId);
    
    if (userState && room) {
      userState.mediaState = 'ready';
      userState.mediaInfo = mediaInfo;
      
      // Update room tracking
      if (room.mediaRequests.has(socket.id)) {
        const mediaRequest = room.mediaRequests.get(socket.id);
        mediaRequest.state = 'ready';
        mediaRequest.completedAt = timestamp;
        mediaRequest.duration = timestamp - mediaRequest.startTime;
        
        console.log(`⏱️ Media request completed in ${mediaRequest.duration}ms`);
      }
      
      // Update participant state
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.mediaState = 'ready';
        participant.mediaInfo = mediaInfo;
      }
      
      // Notify other participants that this user has media ready
      socket.to(roomId).emit('peer-media-ready', {
        userId: socket.id,
        userName: socket.userName,
        mediaInfo: mediaInfo,
        shouldCreateOffer: true // Now we can create offers
      });
      
      // If there are other participants with media, notify this user
      const participantsWithMedia = room.participants.filter(p => 
        p.id !== socket.id && p.mediaState === 'ready'
      );
      
      if (participantsWithMedia.length > 0) {
        socket.emit('peer-media-ready', {
          userId: participantsWithMedia[0].id,
          userName: participantsWithMedia[0].userName,
          mediaInfo: participantsWithMedia[0].mediaInfo,
          shouldCreateOffer: false // This user should wait for offer
        });
      }
      
      console.log(`🎯 Media ready notification sent. Participants with media: ${participantsWithMedia.length + 1}`);
    }
  });

  // 🔧 NEW: Handle media errors (don't disconnect, just log and allow retry)
  socket.on('media-error', ({ roomId, error, timestamp }) => {
    console.log(`❌ Media error for ${socket.id} in room ${roomId}: ${error}`);
    
    const userState = userStates.get(socket.id);
    const room = rooms.get(roomId);
    
    if (userState && room) {
      userState.mediaState = 'error';
      userState.lastError = { error, timestamp };
      
      // Update room tracking
      if (room.mediaRequests.has(socket.id)) {
        const mediaRequest = room.mediaRequests.get(socket.id);
        mediaRequest.state = 'error';
        mediaRequest.error = error;
        mediaRequest.errorAt = timestamp;
      }
      
      // Update participant state
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.mediaState = 'error';
        participant.lastError = error;
      }
      
      // DON'T disconnect - allow user to retry
      console.log(`🔄 User ${socket.id} can retry media request`);
    }
  });

  // 🔧 NEW: Handle media timeouts (extend grace period)
  socket.on('media-timeout', ({ roomId, duration, timestamp }) => {
    console.log(`⏰ Media timeout for ${socket.id} in room ${roomId} after ${duration}ms`);
    
    const userState = userStates.get(socket.id);
    const room = rooms.get(roomId);
    
    if (userState && room) {
      userState.mediaState = 'timeout';
      
      // Update room tracking
      if (room.mediaRequests.has(socket.id)) {
        const mediaRequest = room.mediaRequests.get(socket.id);
        mediaRequest.state = 'timeout';
        mediaRequest.timeoutAt = timestamp;
        mediaRequest.duration = duration;
      }
      
      // Update participant state but keep them in room
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.mediaState = 'timeout';
      }
      
      console.log(`⏳ User ${socket.id} timed out but remains in room for retry`);
    }
  });

  // Standard WebRTC signaling (unchanged)
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
      'lazy-media-loading',
      'media-heartbeats',
      'extended-timeouts',
      'graceful-error-handling',
      'state-tracking'
    ]
  });
});

// Get room info endpoint with media state details
app.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const mediaRequests = Array.from(room.mediaRequests.entries()).map(([userId, request]) => ({
    userId,
    ...request
  }));
  
  res.json({
    roomId,
    participants: room.participants.length,
    participantDetails: room.participants.map(p => ({
      userName: p.userName,
      mediaState: p.mediaState,
      joinedAt: p.joinedAt,
      mediaInfo: p.mediaInfo
    })),
    mediaRequests,
    created: room.created,
    host: room.host
  });
});

// Get all rooms with enhanced details
app.get('/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    roomId: id,
    participants: room.participants.length,
    participantsWithMedia: room.participants.filter(p => p.mediaState === 'ready').length,
    activeMediaRequests: room.mediaRequests.size,
    created: room.created,
    host: room.host
  }));
  
  res.json({
    totalRooms: rooms.size,
    totalUsers: userStates.size,
    rooms: roomList
  });
});

// Get user states (for debugging)
app.get('/users', (req, res) => {
  const users = Array.from(userStates.entries()).map(([id, state]) => ({
    userId: id,
    ...state
  }));
  
  res.json({
    totalUsers: userStates.size,
    users
  });
});

server.listen(port, () => {
  console.log(`🛰️ Enhanced WebRTC Signaling Server running on Render`);
  console.log(`📡 Port: ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Secure WebSocket: wss://biometricov4.onrender.com`);
  console.log(`🎥 Features: Lazy Media Loading, Extended Timeouts, Heartbeats`);
  console.log(`⏱️ Media Request Timeout: 30 seconds`);
  console.log(`💓 Heartbeat Interval: 3 seconds`);
  console.log(`🔄 Graceful Error Recovery: Enabled`);
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

// Enhanced cleanup - remove stale media requests and inactive users
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
  
  // Clean up old empty rooms and stale media requests
  for (const [roomId, room] of rooms.entries()) {
    // Remove stale media requests
    for (const [userId, request] of room.mediaRequests.entries()) {
      if (request.state === 'requesting' && now - request.startTime > 60000) { // 1 minute
        console.log(`🧹 Cleaning up stale media request: ${userId} in ${roomId}`);
        room.mediaRequests.delete(userId);
      }
    }
    
    // Remove empty rooms older than 1 hour
    if (room.participants.length === 0 && now - room.created.getTime() > 60 * 60 * 1000) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up old empty room: ${roomId}`);
    }
  }
}, 2 * 60 * 1000); // Run every 2 minutes