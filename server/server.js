import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// ENHANCED CORS configuration - CRITICAL for deployment
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'https://biometricov4-lunq.onrender.com', // ✅ FRONTEND URL
      'https://biometricov4.onrender.com',
      // Add pattern matching for any Render subdomain
      /^https:\/\/.*\.onrender\.com$/,
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.netlify\.app$/
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      console.log(`✅ CORS: Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Blocking origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Add preflight handling
app.options('*', cors());

// Enhanced Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Same logic as Express CORS
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:5173',
        'https://localhost:5173',
        'http://127.0.0.1:5173',
        'https://biometricov4-lunq.onrender.com',
        'https://biometricov4.onrender.com',
        /^https:\/\/.*\.onrender\.com$/,
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.netlify\.app$/
      ];
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });
      
      if (isAllowed) {
        console.log(`✅ Socket.IO CORS: Allowing origin: ${origin}`);
        callback(null, true);
      } else {
        console.log(`❌ Socket.IO CORS: Blocking origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  // CRITICAL: Allow all origins for Socket.IO as fallback
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    console.log(`🔍 Socket.IO connection attempt from: ${origin || 'no-origin'}`);
    console.log(`🔍 Headers:`, req.headers);
    callback(null, true); // Allow all for debugging
  }
});

// Store room information
const rooms = new Map();
const userStates = new Map();

// Enhanced connection logging
io.on('connection', (socket) => {
  const clientIP = socket.handshake.address;
  const origin = socket.handshake.headers.origin;
  const userAgent = socket.handshake.headers['user-agent'];
  
  console.log('🔗 NEW CONNECTION:');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Origin: ${origin || 'no-origin'}`);
  console.log(`   IP: ${clientIP}`);
  console.log(`   User-Agent: ${userAgent?.substring(0, 100)}...`);
  console.log(`   Transport: ${socket.conn.transport.name}`);
  
  // Initialize user state
  userStates.set(socket.id, {
    state: 'connected',
    roomId: null,
    userName: null,
    mediaState: 'none',
    lastHeartbeat: Date.now(),
    joinedAt: Date.now(),
    origin: origin,
    ip: clientIP
  });

  // Enhanced room joining with detailed logging
  socket.on('join-room', ({ roomId, userName }) => {
    console.log(`👤 JOIN-ROOM REQUEST:`);
    console.log(`   User: ${userName} (${socket.id})`);
    console.log(`   Room: ${roomId}`);
    console.log(`   Origin: ${origin}`);
    
    // Update user state
    const userState = userStates.get(socket.id);
    if (userState) {
      userState.roomId = roomId;
      userState.userName = userName;
      userState.state = 'in_room';
    }
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        host: socket.id,
        created: new Date(),
        mediaRequests: new Map()
      });
      console.log(`🏠 CREATED NEW ROOM: ${roomId}`);
    }

    const room = rooms.get(roomId);
    
    // Prevent duplicate registrations
    if (room.participants.find(p => p.id === socket.id)) {
      console.log(`⚠️ DUPLICATE REGISTRATION: User ${socket.id} already in room ${roomId}`);
      return;
    }
    
    socket.join(roomId);
    socket.userName = userName;
    socket.roomId = roomId;

    room.participants.push({
      id: socket.id,
      userName: userName,
      joinedAt: new Date(),
      mediaState: 'none',
      origin: origin
    });

    console.log(`✅ USER JOINED SUCCESSFULLY:`);
    console.log(`   Room: ${roomId}`);
    console.log(`   Participants: ${room.participants.length}`);
    console.log(`   Participant list: ${room.participants.map(p => p.userName).join(', ')}`);

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

    console.log(`📊 ROOM STATE: ${room.participants.map(p => `${p.userName}(${p.mediaState || 'none'})`).join(', ')}`);
  });

  // Enhanced signaling with logging
  socket.on('offer', ({ offer, roomId }) => {
    console.log(`📤 RELAYING OFFER: Room ${roomId}, From ${socket.id}`);
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, roomId }) => {
    console.log(`📥 RELAYING ANSWER: Room ${roomId}, From ${socket.id}`);
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    console.log(`🧊 RELAYING ICE CANDIDATE: Room ${roomId}, From ${socket.id}`);
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Simple-Peer fallback signaling
  socket.on('simple-peer-signal', ({ signal, roomId }) => {
    console.log(`🔄 RELAYING SIMPLE-PEER SIGNAL: Room ${roomId}, From ${socket.id}`);
    socket.to(roomId).emit('simple-peer-signal', { signal, from: socket.id });
  });

  // Socket.IO streaming fallback
  socket.on('stream-frame', ({ roomId, frame, timestamp }) => {
    console.log(`📺 RELAYING STREAM FRAME: Room ${roomId}, From ${socket.id}, Size: ${frame?.length || 0}`);
    socket.to(roomId).emit('stream-frame', { frame, timestamp, from: socket.id });
  });

  // Media state updates
  socket.on('media-ready', ({ roomId, mediaInfo }) => {
    console.log(`✅ MEDIA READY: User ${socket.id}, Room ${roomId}`);
    console.log(`   Media info:`, mediaInfo);
    
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
      
      console.log(`📊 UPDATED ROOM STATE: ${room.participants.map(p => `${p.userName}(${p.mediaState})`).join(', ')}`);
    }
  });

  // Connection diagnostics
  socket.on('ping-test', (data) => {
    console.log(`🏓 PING TEST: From ${socket.id}`);
    socket.emit('pong-test', { 
      ...data, 
      serverTime: Date.now(),
      socketId: socket.id,
      origin: origin
    });
  });

  // Heartbeat for connection monitoring
  socket.on('heartbeat', (data) => {
    const userState = userStates.get(socket.id);
    if (userState) {
      userState.lastHeartbeat = Date.now();
    }
    
    socket.emit('heartbeat-ack', {
      timestamp: Date.now(),
      socketId: socket.id
    });
  });

  // Enhanced disconnect handling
  socket.on('disconnect', (reason) => {
    console.log(`❌ USER DISCONNECTED:`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Origin: ${origin}`);
    
    const userState = userStates.get(socket.id);
    
    if (userState && userState.roomId && rooms.has(userState.roomId)) {
      const room = rooms.get(userState.roomId);
      
      console.log(`   Was in room: ${userState.roomId}`);
      console.log(`   Username: ${userState.userName}`);
      
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

      console.log(`   Remaining participants: ${room.participants.length}`);

      // Clean up empty rooms
      if (room.participants.length === 0) {
        rooms.delete(userState.roomId);
        console.log(`🗑️ DELETED EMPTY ROOM: ${userState.roomId}`);
      }
    }
    
    // Clean up user state
    userStates.delete(socket.id);
  });

  // Send welcome message to confirm connection
  socket.emit('connection-confirmed', {
    socketId: socket.id,
    serverTime: Date.now(),
    message: 'Successfully connected to signaling server'
  });
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const totalUsers = userStates.size;
  const usersInRooms = Array.from(userStates.values()).filter(u => u.roomId).length;
  const usersWithMedia = Array.from(userStates.values()).filter(u => u.mediaState === 'ready').length;
  
  console.log(`🏥 HEALTH CHECK: ${totalUsers} users, ${rooms.size} rooms`);
  
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
      'connection-diagnostics',
      'enhanced-cors',
      'detailed-logging'
    ],
    environment: process.env.NODE_ENV || 'development'
  });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  const origin = req.headers.origin;
  console.log(`🧪 CORS TEST: Origin ${origin}`);
  
  res.json({
    message: 'CORS test successful',
    origin: origin,
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// Get room info endpoint
app.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  console.log(`📋 ROOM INFO REQUEST: ${roomId}`);
  
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
      mediaInfo: p.mediaInfo,
      origin: p.origin
    })),
    created: room.created,
    host: room.host
  });
});

// Get all rooms
app.get('/rooms', (req, res) => {
  console.log(`📋 ALL ROOMS REQUEST`);
  
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
  const origin = req.headers.origin;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`🔧 CONNECTION TEST: Origin ${origin}, IP ${ip}`);
  
  res.json({
    message: 'Server is reachable',
    timestamp: new Date().toISOString(),
    origin: origin,
    ip: ip,
    headers: req.headers,
    success: true
  });
});

// Add middleware to log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
  next();
});

server.listen(port, '0.0.0.0', () => {
  console.log('🛰️ ========================================');
  console.log('🛰️ ENHANCED WEBRTC SIGNALING SERVER');
  console.log('🛰️ ========================================');
  console.log(`📡 Port: ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Server URL: https://biometricov4.onrender.com`);
  console.log(`🌐 Allowed Origins:`);
  console.log(`   - http://localhost:5173`);
  console.log(`   - https://biometricov4-lunq.onrender.com`);
  console.log(`   - *.onrender.com pattern`);
  console.log(`🎥 Features: WebRTC + Simple-Peer + Socket.IO Streaming`);
  console.log(`🔄 Auto-reconnection: Enabled`);
  console.log(`📊 Enhanced Logging: Enabled`);
  console.log(`✅ Ready for production deployment`);
  console.log('🛰️ ========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Enhanced cleanup with detailed logging
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  let cleanedUsers = 0;
  let cleanedRooms = 0;
  
  // Clean up stale user states
  for (const [userId, userState] of userStates.entries()) {
    if (now - userState.lastHeartbeat > staleThreshold) {
      console.log(`🧹 Cleaning up stale user state: ${userId} (${userState.userName})`);
      userStates.delete(userId);
      cleanedUsers++;
    }
  }
  
  // Clean up old empty rooms
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.length === 0 && now - room.created.getTime() > 60 * 60 * 1000) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up old empty room: ${roomId}`);
      cleanedRooms++;
    }
  }
  
  if (cleanedUsers > 0 || cleanedRooms > 0) {
    console.log(`🧹 Cleanup completed: ${cleanedUsers} users, ${cleanedRooms} rooms`);
  }
}, 2 * 60 * 1000); // Run every 2 minutes

// Log server stats every 5 minutes
setInterval(() => {
  console.log('📊 SERVER STATS:');
  console.log(`   Active connections: ${io.engine.clientsCount}`);
  console.log(`   Total users: ${userStates.size}`);
  console.log(`   Active rooms: ${rooms.size}`);
  console.log(`   Uptime: ${Math.floor(process.uptime())} seconds`);
}, 5 * 60 * 1000);