import { io } from 'socket.io-client';

class ConnectionManager {
  constructor() {
    this.socket = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.connectionState = 'idle';
    this.roomId = null;
    this.userName = null;
    this.isHost = false;
    this.participants = [];
    
    // Callbacks
    this.callbacks = {
      onStateChange: null,
      onRemoteStream: null,
      onParticipantsChange: null,
      onError: null,
      onDebug: null
    };
    
    // Configuración
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      connectionTimeout: 15000, // Increased for deployment
      reconnectAttempts: 5,
      reconnectDelay: 2000
    };
    
    this.debugMode = true;
    this.reconnectAttempts = 0;
    this.heartbeatInterval = null;
  }

  _log(message, level = 'info') {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      const logMessage = `[ConnectionManager ${timestamp}] ${message}`;
      console[level](logMessage);
      
      if (this.callbacks.onDebug) {
        this.callbacks.onDebug(logMessage);
      }
    }
  }

  _setState(newState, data = null) {
    const oldState = this.connectionState;
    this.connectionState = newState;
    
    this._log(`State change: ${oldState} → ${newState}`);
    
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(newState, oldState, data);
    }
  }

  _handleError(error, context = '') {
    this._log(`Error in ${context}: ${error.message}`, 'error');
    
    if (this.callbacks.onError) {
      this.callbacks.onError({
        message: error.message,
        context,
        state: this.connectionState,
        timestamp: new Date().toISOString(),
        suggestion: this._getErrorSuggestion(error, context)
      });
    }
  }

  _getErrorSuggestion(error, context) {
    if (context === 'connectToSignaling' || context === 'joinRoom') {
      if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        return 'The signaling server may be starting up or unreachable. Please wait a moment and try again. If running locally, start the server with "npm run dev" in the server directory.';
      }
      if (error.message.includes('CORS') || error.message.includes('blocked')) {
        return 'CORS error detected. Please check server configuration.';
      }
      if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        return 'Network connectivity issue. Please check your internet connection.';
      }
    }
    return 'Please check your internet connection and try again. If the problem persists, the server may be temporarily unavailable.';
  }

  _getServerUrls() {
    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
    
    this._log(`Detecting environment: ${currentHost} (localhost: ${isLocalhost})`);
    
    if (isLocalhost) {
      // Local development - try local server first, then production fallback
      return [
        'http://localhost:3000',
        'https://biometricov4.onrender.com'
      ];
    } else {
      // Production deployment - use backend server
      return [
        'https://biometricov4.onrender.com'
      ];
    }
  }

  async connectToSignaling() {
    const servers = this._getServerUrls();
    
    this._log(`Attempting to connect to ${servers.length} server(s)...`);
    
    for (let i = 0; i < servers.length; i++) {
      const serverUrl = servers[i];
      this._log(`Connection attempt ${i + 1}/${servers.length}: ${serverUrl}`);
      
      try {
        // First test HTTP connectivity
        await this._testHttpConnectivity(serverUrl);
        
        // Then try Socket.IO connection
        await this._tryConnectToServer(serverUrl);
        
        this._log(`✅ Successfully connected to: ${serverUrl}`);
        this._startHeartbeat();
        return;
        
      } catch (error) {
        this._log(`❌ Failed to connect to ${serverUrl}: ${error.message}`, 'warn');
        
        if (i === servers.length - 1) {
          // Last attempt failed
          throw new Error(`Failed to connect to any signaling server. Last error: ${error.message}`);
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async _testHttpConnectivity(serverUrl) {
    const testUrl = serverUrl + '/health';
    this._log(`Testing HTTP connectivity: ${testUrl}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this._log(`✅ HTTP connectivity test passed: ${data.status}`);
      
      return data;
      
    } catch (error) {
      this._log(`❌ HTTP connectivity test failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async _tryConnectToServer(serverUrl) {
    return new Promise((resolve, reject) => {
      this._log(`Establishing Socket.IO connection to: ${serverUrl}`);
      
      // Clean up existing socket
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      // Enhanced Socket.IO configuration for deployment
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: false,
        timeout: this.config.connectionTimeout,
        forceNew: true,
        reconnection: false, // We handle reconnection manually
        autoConnect: true,
        withCredentials: true,
        // Additional options for deployment
        extraHeaders: {
          'Origin': window.location.origin
        },
        query: {
          'client-type': 'webrtc-room',
          'timestamp': Date.now()
        }
      });

      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.disconnect();
        }
        reject(new Error(`Socket.IO connection timeout after ${this.config.connectionTimeout}ms`));
      }, this.config.connectionTimeout);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this._log(`✅ Socket.IO connected: ${this.socket.id}`);
        this._log(`   Transport: ${this.socket.io.engine.transport.name}`);
        this._log(`   Server: ${serverUrl}`);
        
        this._setupSocketListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        this._log(`❌ Socket.IO connection error: ${error.message}`, 'error');
        this._log(`   Error type: ${error.type}`);
        this._log(`   Error description: ${error.description}`);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        clearTimeout(timeout);
        this._log(`🔌 Socket.IO disconnected: ${reason}`, 'warn');
        
        if (reason !== 'io client disconnect') {
          this._setState('disconnected');
          this._attemptReconnect();
        }
      });

      // Listen for connection confirmation
      this.socket.on('connection-confirmed', (data) => {
        this._log(`✅ Connection confirmed by server: ${data.message}`);
        this._log(`   Server time: ${new Date(data.serverTime).toISOString()}`);
      });
    });
  }

  _startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds
    
    this._log('Started heartbeat monitoring');
  }

  _setupSocketListeners() {
    // Heartbeat acknowledgment
    this.socket.on('heartbeat-ack', (data) => {
      this._log(`💓 Heartbeat acknowledged by server`);
    });

    this.socket.on('user-joined', (data) => {
      this._log(`👤 User joined: ${JSON.stringify(data)}`);
      this.participants = data.participants || [];
      
      if (this.callbacks.onParticipantsChange) {
        this.callbacks.onParticipantsChange(this.participants);
      }

      // Si tenemos stream local y hay otros participantes, iniciar conexión
      if (this.localStream && this.participants.length > 1) {
        this._log('Starting peer connection with existing participants');
        this._initiatePeerConnection();
      }
    });

    this.socket.on('user-left', (data) => {
      this._log(`👋 User left: ${JSON.stringify(data)}`);
      this.participants = data.participants || [];
      
      if (this.callbacks.onParticipantsChange) {
        this.callbacks.onParticipantsChange(this.participants);
      }
      
      this._clearRemoteStream();
    });

    // WebRTC signaling
    this.socket.on('offer', async (data) => {
      if (data.from !== this.socket.id) {
        await this._handleOffer(data.offer, data.from);
      }
    });

    this.socket.on('answer', async (data) => {
      if (data.from !== this.socket.id) {
        await this._handleAnswer(data.answer);
      }
    });

    this.socket.on('ice-candidate', async (data) => {
      if (data.from !== this.socket.id) {
        await this._handleIceCandidate(data.candidate);
      }
    });

    // Fallback: Simple-Peer signaling
    this.socket.on('simple-peer-signal', (data) => {
      if (this.simplePeer && data.roomId === this.roomId) {
        this._log('Received Simple-Peer signal');
        this.simplePeer.signal(data.signal);
      }
    });

    // Fallback: Socket.IO streaming
    this.socket.on('stream-frame', (data) => {
      if (data.roomId === this.roomId) {
        this._handleSocketStreamFrame(data);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this._log(`🔌 Socket disconnected: ${reason}`, 'warn');
      this._setState('disconnected');
      
      if (reason !== 'io client disconnect') {
        this._attemptReconnect();
      }
    });
  }

  async joinRoom(roomId, userName, isHost = false) {
    try {
      this._setState('joining');
      this.roomId = roomId;
      this.userName = userName;
      this.isHost = isHost;

      this._log(`Joining room: ${roomId} as ${userName} (host: ${isHost})`);

      // Ensure we're connected
      if (!this.socket || !this.socket.connected) {
        this._log('Socket not connected, attempting to connect...');
        await this.connectToSignaling();
      }

      // Verify connection after attempt
      if (!this.socket || !this.socket.connected) {
        throw new Error('Unable to establish connection to signaling server');
      }

      this._log(`Sending join-room request...`);
      
      // Send join-room with enhanced timeout handling
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Room join timeout - server may be busy'));
        }, 10000); // Increased timeout

        this.socket.emit('join-room', { 
          roomId, 
          userName 
        });

        // Listen for successful join
        const onUserJoined = (data) => {
          this._log(`Received user-joined event: ${JSON.stringify(data)}`);
          
          if (data.participants && data.participants.includes(userName)) {
            clearTimeout(timeout);
            this.socket.off('user-joined', onUserJoined);
            this._log(`✅ Successfully joined room ${roomId}`);
            resolve();
          }
        };

        this.socket.on('user-joined', onUserJoined);
        
        // Also resolve if we get a connection-confirmed event
        const onConnectionConfirmed = () => {
          clearTimeout(timeout);
          this.socket.off('connection-confirmed', onConnectionConfirmed);
          this._log(`✅ Connection confirmed, assuming room join successful`);
          resolve();
        };
        
        this.socket.on('connection-confirmed', onConnectionConfirmed);
      });

      this._setState('connected');
      this._log(`✅ Room join completed successfully`);
      
      return { success: true };

    } catch (error) {
      this._setState('error');
      this._handleError(error, 'joinRoom');
      throw error;
    }
  }

  async addLocalStream(stream) {
    this._log('Adding local stream');
    this.localStream = stream;

    // Notify server about media readiness
    if (this.socket && this.socket.connected && this.roomId) {
      this.socket.emit('media-ready', {
        roomId: this.roomId,
        mediaInfo: {
          hasVideo: stream.getVideoTracks().length > 0,
          hasAudio: stream.getAudioTracks().length > 0,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        }
      });
    }

    // If there are other participants, start peer connection
    if (this.participants.length > 1) {
      await this._initiatePeerConnection();
    }

    return { success: true };
  }

  async _initiatePeerConnection() {
    this._log('Initiating peer connection...');
    
    try {
      // Method 1: WebRTC nativo
      await this._tryNativeWebRTC();
    } catch (error) {
      this._log('Native WebRTC failed, trying Simple-Peer fallback', 'warn');
      
      try {
        // Method 2: Simple-Peer fallback
        await this._trySimplePeerFallback();
      } catch (error2) {
        this._log('Simple-Peer failed, using Socket.IO streaming fallback', 'warn');
        
        // Method 3: Socket.IO streaming fallback
        this._useSocketStreamingFallback();
      }
    }
  }

  async _tryNativeWebRTC() {
    this._log('Trying native WebRTC...');
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10
    });

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this._log(`Adding ${track.kind} track to peer connection`);
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Event listeners
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this._log('✅ Received remote stream via WebRTC');
      this.remoteStream = remoteStream;
      
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(remoteStream);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.socket.connected) {
        this._log('Sending ICE candidate');
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          roomId: this.roomId
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this._log(`Peer connection state: ${state}`);
      
      if (state === 'connected') {
        this._log('✅ WebRTC peer connection established');
        this._setState('peer_connected');
      } else if (state === 'failed' || state === 'disconnected') {
        this._log('WebRTC connection failed, trying fallback', 'warn');
        this._trySimplePeerFallback().catch(() => {
          this._useSocketStreamingFallback();
        });
      }
    };

    // Create offer if we're the host or first with media
    if (this.isHost || this.participants.length === 2) {
      await this._createOffer();
    }
  }

  async _createOffer() {
    try {
      this._log('Creating WebRTC offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('offer', { 
        offer, 
        roomId: this.roomId 
      });
      
      this._log('✅ Offer sent');
    } catch (error) {
      this._log(`Error creating offer: ${error.message}`, 'error');
      throw error;
    }
  }

  async _handleOffer(offer, fromId) {
    try {
      this._log(`Handling offer from ${fromId}`);
      
      if (!this.peerConnection) {
        await this._tryNativeWebRTC();
      }
      
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.socket.emit('answer', { 
        answer, 
        roomId: this.roomId 
      });
      
      this._log('✅ Answer sent');
    } catch (error) {
      this._log(`Error handling offer: ${error.message}`, 'error');
      throw error;
    }
  }

  async _handleAnswer(answer) {
    try {
      this._log('Handling answer');
      
      if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(answer);
        this._log('✅ Answer handled');
      }
    } catch (error) {
      this._log(`Error handling answer: ${error.message}`, 'error');
    }
  }

  async _handleIceCandidate(candidate) {
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(candidate);
        this._log('✅ ICE candidate added');
      }
    } catch (error) {
      this._log(`Error handling ICE candidate: ${error.message}`, 'error');
    }
  }

  async _trySimplePeerFallback() {
    this._log('Trying Simple-Peer fallback...');
    
    try {
      const SimplePeer = (await import('simple-peer')).default;
      
      const peer = new SimplePeer({
        initiator: this.isHost,
        trickle: false,
        stream: this.localStream,
        config: {
          iceServers: this.config.iceServers
        }
      });

      peer.on('signal', (data) => {
        this._log('Sending Simple-Peer signal');
        this.socket.emit('simple-peer-signal', {
          signal: data,
          roomId: this.roomId
        });
      });

      peer.on('stream', (stream) => {
        this._log('✅ Received remote stream via Simple-Peer');
        this.remoteStream = stream;
        
        if (this.callbacks.onRemoteStream) {
          this.callbacks.onRemoteStream(stream);
        }
      });

      peer.on('connect', () => {
        this._log('✅ Simple-Peer connection established');
        this._setState('peer_connected');
      });

      peer.on('error', (error) => {
        this._log(`Simple-Peer error: ${error.message}`, 'error');
        throw error;
      });

      this.simplePeer = peer;
      
    } catch (error) {
      this._log(`Failed to load Simple-Peer: ${error.message}`, 'error');
      throw error;
    }
  }

  _useSocketStreamingFallback() {
    this._log('Using Socket.IO streaming fallback');
    this._setState('socket_streaming');

    if (!this.localStream) return;

    // Set up frame capture for streaming
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    
    video.srcObject = this.localStream;
    video.play();

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;

      // Send frames every 200ms (5 FPS) to reduce bandwidth
      const streamInterval = setInterval(() => {
        if (this.connectionState !== 'socket_streaming') {
          clearInterval(streamInterval);
          return;
        }

        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frameData = canvas.toDataURL('image/jpeg', 0.3); // Lower quality for bandwidth
          
          this.socket.emit('stream-frame', {
            roomId: this.roomId,
            frame: frameData,
            timestamp: Date.now()
          });
        } catch (error) {
          this._log(`Error capturing frame: ${error.message}`, 'error');
        }
      }, 200);

      this.streamInterval = streamInterval;
    };

    // Create remote video for received frames
    this._createRemoteVideoForSocketStream();
  }

  _createRemoteVideoForSocketStream() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 240;

    // Convert canvas to stream
    const stream = canvas.captureStream(5); // 5 FPS
    this.remoteStream = stream;

    if (this.callbacks.onRemoteStream) {
      this.callbacks.onRemoteStream(stream);
    }

    this._log('✅ Socket.IO streaming established');
  }

  _handleSocketStreamFrame(data) {
    if (!this.remoteStream) return;
    
    try {
      // Find canvas from the remote stream
      const canvas = document.querySelector('canvas'); // This is a simplified approach
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = data.frame;
      }
    } catch (error) {
      this._log(`Error handling socket stream frame: ${error.message}`, 'error');
    }
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this._log('Max reconnection attempts reached', 'error');
      this._setState('error');
      this._handleError(new Error('Unable to reconnect to server after multiple attempts'), 'reconnection');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * this.reconnectAttempts;
    
    this._log(`Attempting reconnection ${this.reconnectAttempts}/${this.config.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connectToSignaling();
        
        if (this.roomId && this.userName) {
          await this.joinRoom(this.roomId, this.userName, this.isHost);
          
          if (this.localStream) {
            await this.addLocalStream(this.localStream);
          }
        }
        
        this.reconnectAttempts = 0;
        this._log('✅ Reconnection successful');
      } catch (error) {
        this._log(`Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`, 'error');
        this._attemptReconnect();
      }
    }, delay);
  }

  _clearRemoteStream() {
    if (this.remoteStream) {
      this.remoteStream = null;
      
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(null);
      }
    }
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getState() {
    return {
      connectionState: this.connectionState,
      roomId: this.roomId,
      userName: this.userName,
      participants: this.participants,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      isSocketConnected: this.socket && this.socket.connected,
      peerConnectionState: this.peerConnection ? this.peerConnection.connectionState : null,
      reconnectAttempts: this.reconnectAttempts,
      serverUrl: this.socket ? this.socket.io.uri : null
    };
  }

  cleanup() {
    this._log('Cleaning up ConnectionManager...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.simplePeer) {
      this.simplePeer.destroy();
      this.simplePeer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this._clearRemoteStream();
    this.localStream = null;
    this._setState('idle');
    
    this._log('✅ Cleanup completed');
  }
}

export default ConnectionManager;