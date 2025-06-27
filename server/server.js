import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// 🔧 FIXED: CORS configuration mejorada para guests
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'https://biometricov4-lunq.onrender.com', // Frontend URL
      'https://biometricov4.onrender.com',
      // Pattern matching for any Render subdomain
      /^https:\/\/.*\.onrender\.com$/,
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.netlify\.app$/,
      // Local development patterns
      /^http:\/\/localhost:\d+$/,
      /^https:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/127\.0\.0\.1:\d+$/
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
      // 🔧 FIXED: Allow anyway for debugging guest issues
      console.log(`🔧 DEBUG: Allowing blocked origin for guest debugging: ${origin}`);
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Add preflight handling
app.options('*', cors());

// 🔧 FIXED: Enhanced Socket.IO configuration for guests
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Same logic as Express CORS but more permissive for guests
      console.log(`🔍 Socket.IO CORS check for origin: ${origin || 'no-origin'}`);
      
      if (!origin) {
        console.log(`✅ Socket.IO: Allowing no-origin request`);
        return callback(null, true);
      }
      
      const allowedOrigins = [
        'http://localhost:5173',
        'https://localhost:5173',
        'http://127.0.0.1:5173',
        'https://biometricov4-lunq.onrender.com',
        'https://biometricov4.onrender.com',
        /^https:\/\/.*\.onrender\.com$/,
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.netlify\.app$/,
        /^http:\/\/localhost:\d+$/,
        /^https:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^https:\/\/127\.0\.0\.1:\d+$/
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
        // 🔧 FIXED: Allow anyway for guest debugging
        console.log(`🔧 DEBUG: Allowing blocked origin for guest debugging: ${origin}`);
        callback(null, true);
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
  // 🔧 FIXED: More permissive connection handling for guests
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'];
    const clientType = req._query?.['client-type'];
    const role = req._query?.role;
    
    console.log(`🔍 Socket.IO connection attempt:`);
    console.log(`   Origin: ${origin || 'no-origin'}`);
    console.log(`   User-Agent: ${userAgent?.substring(0, 50)}...`);
    console.log(`   Client-Type: ${clientType || 'unknown'}`);
    console.log(`   Role: ${role || 'unknown'}`);
    console.log(`   IP: ${req.socket.remoteAddress}`);
    
    // Always allow for guest debugging
    callback(null, true);
  }
});

// Store room information with enhanced tracking
const rooms = new Map();
const userStates = new Map();
const connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  guestConnections: 0,
  hostConnections: 0,
  failedConnections: 0
};

// 🔧 FIXED: Enhanced connection logging for guest debugging
io.on('connection', (socket) => {
  const clientIP = socket.handshake.address;
  const origin = socket.handshake.headers.origin;
  const userAgent = socket.handshake.headers['user-agent'];
  const clientType = socket.handshake.query['client-type'];
  const role = socket.handshake.query.role;
  const timestamp = socket.handshake.query.timestamp;
  const attempt = socket.handshake.query.attempt;
  
  connectionStats.totalConnections++;
  connectionStats.activeConnections++;
  
  if (role === 'guest') {
    connectionStats.guestConnections++;
  } else if (role === 'host') {
    connectionStats.hostConnections++;
  }
  
  console.log('🔗 ENHANCED CONNECTION:');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Role: ${role || 'unknown'}`);
  console.log(`   Origin: ${origin || 'no-origin'}`);
  console.log(`   IP: ${clientIP}`);
  console.log(`   Client-Type: ${clientType || 'unknown'}`);
  console.log(`   Attempt: ${attempt || '1'}`);
  console.log(`   Timestamp: ${timestamp ? new Date(parseInt(timestamp)).toISOString() : 'unknown'}`);
  console.log(`   Transport: ${socket.conn.transport.name}`);
  console.log(`   User-Agent: ${userAgent?.substring(0, 100)}...`);
  console.log(`   Stats: Total=${connectionStats.totalConnections}, Active=${connectionStats.activeConnections}, Guests=${connectionStats.guestConnections}, Hosts=${connectionStats.hostConnections}`);
  
  // Initialize enhanced user state
  userStates.set(socket.id, {
    state: 'connected',
    role: role || 'unknown',
    roomId: null,
    userName: null,
    mediaState: 'none',
    lastHeartbeat: Date.now(),
    joinedAt: Date.now(),
    origin: origin,
    ip: clientIP,
    userAgent: userAgent,
    clientType: clientType,
    connectionAttempt: parseInt(attempt) || 1
  });

  // 🔧 FIXED: Enhanced room joining with guest-specific handling
  socket.on('join-room', ({ roomId, userName, role: userRole, timestamp: joinTimestamp }) => {
    console.log(`👤 ENHANCED JOIN-ROOM REQUEST:`);
    console.log(`   User: ${userName} (${socket.id})`);
    console.log(`   Room: ${roomId}`);
    console.log(`   Role: ${userRole || 'unknown'}`);
    console.log(`   Origin: ${origin}`);
    console.log(`   Join Timestamp: ${joinTimestamp ? new Date(joinTimestamp).toISOString() : 'unknown'}`);
    
    // Update user state
    const userState = userStates.get(socket.id);
    if (userState) {
      userState.roomId = roomId;
      userState.userName = userName;
      userState.role = userRole || userState.role;
      userState.state = 'in_room';
    }
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        host: userRole === 'host' ? socket.id : null,
        created: new Date(),
        mediaRequests: new Map(),
        guestCount: 0,
        hostCount: 0
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
    socket.userRole = userRole;

    const participant = {
      id: socket.id,
      userName: userName,
      role: userRole || 'unknown',
      joinedAt: new Date(),
      mediaState: 'none',
      origin: origin,
      ip: clientIP
    };

    room.participants.push(participant);
    
    // Update room stats
    if (userRole === 'guest') {
      room.guestCount++;
    } else if (userRole === 'host') {
      room.hostCount++;
      if (!room.host) {
        room.host = socket.id;
      }
    }

    console.log(`✅ USER JOINED SUCCESSFULLY:`);
    console.log(`   Room: ${roomId}`);
    console.log(`   Participants: ${room.participants.length} (${room.hostCount} hosts, ${room.guestCount} guests)`);
    console.log(`   Participant list: ${room.participants.map(p => `${p.userName}(${p.role})`).join(', ')}`);

    // 🔧 FIXED: Enhanced notification with role information
    const participantNames = room.participants.map(p => p.userName);
    const notificationData = {
      userId: socket.id,
      userName: userName,
      role: userRole,
      participants: participantNames,
      participantCount: room.participants.length,
      shouldCreateOffer: false,
      roomStats: {
        hosts: room.hostCount,
        guests: room.guestCount,
        total: room.participants.length
      }
    };

    // Notify existing participants about new user
    socket.to(roomId).emit('user-joined', notificationData);

    // Notify the new user about room state
    socket.emit('user-joined', notificationData);

    console.log(`📊 ENHANCED ROOM STATE: ${room.participants.map(p => `${p.userName}(${p.role}:${p.mediaState || 'none'})`).join(', ')}`);
  });

  // 🔧 FIXED: Enhanced signaling with role-aware logging
  socket.on('offer', ({ offer, roomId }) => {
    const userState = userStates.get(socket.id);
    console.log(`📤 RELAYING OFFER: Room ${roomId}, From ${socket.id} (${userState?.role || 'unknown'}:${userState?.userName || 'unknown'})`);
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, roomId }) => {
    const userState = userStates.get(socket.id);
    console.log(`📥 RELAYING ANSWER: Room ${roomId}, From ${socket.id} (${userState?.role || 'unknown'}:${userState?.userName || 'unknown'})`);
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    const userState = userStates.get(socket.id);
    console.log(`🧊 RELAYING ICE CANDIDATE: Room ${roomId}, From ${socket.id} (${userState?.role || 'unknown'}:${userState?.userName || 'unknown'})`);
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // 🔧 FIXED: Enhanced media state tracking
  socket.on('media-ready', ({ roomId, mediaInfo, timestamp: mediaTimestamp }) => {
    const userState = userStates.get(socket.id);
    console.log(`✅ MEDIA READY: User ${socket.id} (${userState?.role || 'unknown'}:${userState?.userName || 'unknown'}), Room ${roomId}`);
    console.log(`   Media info:`, mediaInfo);
    console.log(`   Media timestamp: ${mediaTimestamp ? new Date(mediaTimestamp).toISOString() : 'unknown'}`);
    
    const room = rooms.get(roomId);
    if (room) {
      // Update participant state
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.mediaState = 'ready';
        participant.mediaInfo = mediaInfo;
        participant.mediaReadyAt = new Date();
      }
      
      // Update user state
      if (userState) {
        userState.mediaState = 'ready';
      }
      
      // Notify other participants
      socket.to(roomId).emit('peer-media-ready', {
        userId: socket.id,
        userName: socket.userName,
        role: userState?.role,
        mediaInfo: mediaInfo
      });
      
      console.log(`📊 UPDATED ROOM STATE: ${room.participants.map(p => `${p.userName}(${p.role}:${p.mediaState})`).join(', ')}`);
    }
  });

  // 🔧 FIXED: Scan notification handling
  socket.on('scan-notification', (data) => {
    const userState = userStates.get(socket.id);
    console.log(`📢 SCAN: Received scan notification from ${socket.id} (${userState?.userName || 'unknown'})`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Message: ${data.message}`);
    console.log(`   Room: ${data.roomId}`);
    console.log(`   Duration: ${data.duration || 'default'}`);
    
    // Validate the notification
    if (!data.roomId || !data.type || !data.message) {
      console.log(`❌ SCAN: Invalid notification data`);
      return;
    }
    
    // Check if user is in the room
    const room = rooms.get(data.roomId);
    if (!room || !room.participants.find(p => p.id === socket.id)) {
      console.log(`❌ SCAN: User not in room ${data.roomId}`);
      return;
    }
    
    // Broadcast to all other participants in the room
    const notificationData = {
      ...data,
      from: socket.id,
      fromName: userState?.userName || 'Unknown User',
      timestamp: Date.now()
    };
    
    console.log(`📢 SCAN: Broadcasting notification to room ${data.roomId}`);
    socket.to(data.roomId).emit('scan-notification', notificationData);
    
    console.log(`✅ SCAN: Notification broadcasted successfully`);
  });

  // 🔧 ADDED: Enhanced heartbeat with role tracking
  socket.on('heartbeat', ({ timestamp: heartbeatTimestamp, role: heartbeatRole, roomId: heartbeatRoomId }) => {
    const userState = userStates.get(socket.id);
    if (userState) {
      userState.lastHeartbeat = Date.now();
    }
    
    console.log(`💓 HEARTBEAT: ${socket.id} (${heartbeatRole || userState?.role || 'unknown'}:${userState?.userName || 'unknown'}) in room ${heartbeatRoomId || 'none'}`);
    
    socket.emit('heartbeat-ack', {
      timestamp: Date.now(),
      socketId: socket.id,
      serverTime: new Date().toISOString()
    });
  });

  // Connection diagnostics
  socket.on('ping-test', (data) => {
    const userState = userStates.get(socket.id);
    console.log(`🏓 PING TEST: From ${socket.id} (${userState?.role || 'unknown'})`);
    socket.emit('pong-test', { 
      ...data, 
      serverTime: Date.now(),
      socketId: socket.id,
      origin: origin,
      role: userState?.role
    });
  });

  // 🔧 FIXED: Enhanced disconnect handling with guest-specific logging
  socket.on('disconnect', (reason) => {
    connectionStats.activeConnections--;
    
    const userState = userStates.get(socket.id);
    
    console.log(`❌ ENHANCED USER DISCONNECTED:`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Role: ${userState?.role || 'unknown'}`);
    console.log(`   Username: ${userState?.userName || 'unknown'}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Origin: ${origin}`);
    console.log(`   Connection Duration: ${userState ? Math.round((Date.now() - userState.joinedAt) / 1000) : 'unknown'}s`);
    console.log(`   Last Heartbeat: ${userState?.lastHeartbeat ? Math.round((Date.now() - userState.lastHeartbeat) / 1000) : 'unknown'}s ago`);
    
    if (userState?.role === 'guest') {
      connectionStats.guestConnections--;
      if (reason !== 'client namespace disconnect' && reason !== 'io client disconnect') {
        connectionStats.failedConnections++;
        console.log(`⚠️ GUEST DISCONNECTION MAY BE UNEXPECTED: ${reason}`);
      }
    } else if (userState?.role === 'host') {
      connectionStats.hostConnections--;
    }
    
    if (userState && userState.roomId && rooms.has(userState.roomId)) {
      const room = rooms.get(userState.roomId);
      
      console.log(`   Was in room: ${userState.roomId}`);
      
      // Remove from participants
      room.participants = room.participants.filter(p => p.id !== socket.id);
      
      // Update room stats
      if (userState.role === 'guest') {
        room.guestCount = Math.max(0, room.guestCount - 1);
      } else if (userState.role === 'host') {
        room.hostCount = Math.max(0, room.hostCount - 1);
      }
      
      // Clean up media request tracking
      if (room.mediaRequests.has(socket.id)) {
        room.mediaRequests.delete(socket.id);
      }
      
      // Notify remaining participants
      socket.to(userState.roomId).emit('user-left', {
        userId: socket.id,
        userName: userState.userName,
        role: userState.role,
        participants: room.participants.map(p => p.userName),
        participantCount: room.participants.length,
        roomStats: {
          hosts: room.hostCount,
          guests: room.guestCount,
          total: room.participants.length
        }
      });

      console.log(`   Remaining participants: ${room.participants.length} (${room.hostCount} hosts, ${room.guestCount} guests)`);

      // Clean up empty rooms
      if (room.participants.length === 0) {
        rooms.delete(userState.roomId);
        console.log(`🗑️ DELETED EMPTY ROOM: ${userState.roomId}`);
      }
    }
    
    // Clean up user state
    userStates.delete(socket.id);
    
    console.log(`📊 UPDATED STATS: Total=${connectionStats.totalConnections}, Active=${connectionStats.activeConnections}, Guests=${connectionStats.guestConnections}, Hosts=${connectionStats.hostConnections}, Failed=${connectionStats.failedConnections}`);
  });

  // Send enhanced welcome message
  socket.emit('connection-confirmed', {
    socketId: socket.id,
    serverTime: Date.now(),
    timestamp: new Date().toISOString(),
    message: 'Successfully connected to enhanced signaling server',
    role: role || 'unknown',
    features: [
      'enhanced-webrtc',
      'guest-debugging',
      'role-tracking',
      'connection-diagnostics',
      'auto-reconnection',
      'scan-notifications'
    ]
  });
});

// 🔧 FIXED: Enhanced health check with guest statistics
app.get('/health', (req, res) => {
  const totalUsers = userStates.size;
  const usersInRooms = Array.from(userStates.values()).filter(u => u.roomId).length;
  const usersWithMedia = Array.from(userStates.values()).filter(u => u.mediaState === 'ready').length;
  const guestUsers = Array.from(userStates.values()).filter(u => u.role === 'guest').length;
  const hostUsers = Array.from(userStates.values()).filter(u => u.role === 'host').length;
  
  console.log(`🏥 ENHANCED HEALTH CHECK: ${totalUsers} users (${hostUsers} hosts, ${guestUsers} guests), ${rooms.size} rooms`);
  
  res.json({ 
    status: 'OK',
    server: 'Enhanced WebRTC Signaling Server with Guest Debugging',
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    connections: io.engine.clientsCount,
    totalUsers,
    hostUsers,
    guestUsers,
    usersInRooms,
    usersWithMedia,
    connectionStats,
    uptime: process.uptime(),
    features: [
      'enhanced-webrtc',
      'guest-connection-debugging',
      'role-based-tracking',
      'connection-diagnostics',
      'auto-reconnection',
      'detailed-logging',
      'cors-debugging',
      'scan-notifications'
    ],
    environment: process.env.NODE_ENV || 'development'
  });
});

// 🔧 ADDED: Enhanced CORS test endpoint
app.get('/cors-test', (req, res) => {
  const origin = req.headers.origin;
  const userAgent = req.headers['user-agent'];
  console.log(`🧪 ENHANCED CORS TEST: Origin ${origin}, User-Agent: ${userAgent?.substring(0, 50)}...`);
  
  res.json({
    message: 'Enhanced CORS test successful',
    origin: origin,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    corsEnabled: true,
    guestDebugging: true
  });
});

// 🔧 FIXED: Enhanced room info with guest statistics
app.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  console.log(`📋 ENHANCED ROOM INFO REQUEST: ${roomId}`);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId,
    participants: room.participants.length,
    hostCount: room.hostCount,
    guestCount: room.guestCount,
    participantDetails: room.participants.map(p => ({
      userName: p.userName,
      role: p.role,
      mediaState: p.mediaState,
      joinedAt: p.joinedAt,
      mediaInfo: p.mediaInfo,
      origin: p.origin,
      ip: p.ip
    })),
    created: room.created,
    host: room.host
  });
});

// Enhanced all rooms endpoint
app.get('/rooms', (req, res) => {
  console.log(`📋 ENHANCED ALL ROOMS REQUEST`);
  
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    roomId: id,
    participants: room.participants.length,
    hostCount: room.hostCount,
    guestCount: room.guestCount,
    participantsWithMedia: room.participants.filter(p => p.mediaState === 'ready').length,
    created: room.created,
    host: room.host
  }));
  
  res.json({
    totalRooms: rooms.size,
    totalUsers: userStates.size,
    connectionStats,
    rooms: roomList
  });
});

// Enhanced connection test endpoint
app.get('/test-connection', (req, res) => {
  const origin = req.headers.origin;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  console.log(`🔧 ENHANCED CONNECTION TEST: Origin ${origin}, IP ${ip}, User-Agent: ${userAgent?.substring(0, 50)}...`);
  
  res.json({
    message: 'Enhanced server is reachable',
    timestamp: new Date().toISOString(),
    origin: origin,
    ip: ip,
    userAgent: userAgent,
    headers: req.headers,
    success: true,
    guestDebugging: true,
    corsEnabled: true
  });
});

// Add middleware to log all requests with enhanced details
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'];
  console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}, User-Agent: ${userAgent?.substring(0, 50)}...`);
  next();
});

server.listen(port, '0.0.0.0', () => {
  console.log('🛰️ ========================================');
  console.log('🛰️ ENHANCED WEBRTC SIGNALING SERVER');
  console.log('🛰️ WITH GUEST CONNECTION DEBUGGING');
  console.log('🛰️ AND SCAN NOTIFICATIONS');
  console.log('🛰️ ========================================');
  console.log(`📡 Port: ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Server URL: https://biometricov4.onrender.com`);
  console.log(`🌐 Enhanced CORS Origins:`);
  console.log(`   - http://localhost:5173`);
  console.log(`   - https://biometricov4-lunq.onrender.com`);
  console.log(`   - *.onrender.com pattern`);
  console.log(`   - All localhost patterns`);
  console.log(`🎥 Features: Enhanced WebRTC + Guest Debugging + Scan Notifications`);
  console.log(`🔄 Auto-reconnection: Enabled`);
  console.log(`📊 Enhanced Logging: Enabled`);
  console.log(`🐛 Guest Debugging: Enabled`);
  console.log(`📢 Scan Notifications: Enabled`);
  console.log(`✅ Ready for production with guest support`);
  console.log('🛰️ ========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Enhanced server closed');
    process.exit(0);
  });
});

// Enhanced cleanup with guest statistics
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  let cleanedUsers = 0;
  let cleanedRooms = 0;
  let cleanedGuests = 0;
  let cleanedHosts = 0;
  
  // Clean up stale user states
  for (const [userId, userState] of userStates.entries()) {
    if (now - userState.lastHeartbeat > staleThreshold) {
      console.log(`🧹 Cleaning up stale user state: ${userId} (${userState.role}:${userState.userName})`);
      
      if (userState.role === 'guest') {
        cleanedGuests++;
        connectionStats.guestConnections = Math.max(0, connectionStats.guestConnections - 1);
      } else if (userState.role === 'host') {
        cleanedHosts++;
        connectionStats.hostConnections = Math.max(0, connectionStats.hostConnections - 1);
      }
      
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
    console.log(`🧹 Enhanced cleanup completed: ${cleanedUsers} users (${cleanedHosts} hosts, ${cleanedGuests} guests), ${cleanedRooms} rooms`);
  }
}, 2 * 60 * 1000); // Run every 2 minutes

// Enhanced server stats logging
setInterval(() => {
  const guestUsers = Array.from(userStates.values()).filter(u => u.role === 'guest').length;
  const hostUsers = Array.from(userStates.values()).filter(u => u.role === 'host').length;
  
  console.log('📊 ENHANCED SERVER STATS:');
  console.log(`   Active connections: ${io.engine.clientsCount}`);
  console.log(`   Total users: ${userStates.size} (${hostUsers} hosts, ${guestUsers} guests)`);
  console.log(`   Active rooms: ${rooms.size}`);
  console.log(`   Connection stats: Total=${connectionStats.totalConnections}, Failed=${connectionStats.failedConnections}`);
  console.log(`   Uptime: ${Math.floor(process.uptime())} seconds`);
}, 5 * 60 * 1000);