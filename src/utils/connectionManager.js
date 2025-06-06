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
      connectionTimeout: 15000,
      reconnectAttempts: 5,
      reconnectDelay: 2000
    };
    
    this.debugMode = true;
    this.reconnectAttempts = 0;
    this.heartbeatInterval = null;
    this.streamingInterval = null;
    
    // 🔧 FIXED: Elementos para Socket.IO streaming (sin CanvasRenderer por ahora)
    this.localCanvas = null;
    this.remoteCanvas = null;
    this.localVideo = null;
    this.frameCount = 0;
    this.lastFrameTime = 0;
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
        return 'The signaling server may be starting up or unreachable. Please wait a moment and try again.';
      }
      if (error.message.includes('CORS') || error.message.includes('blocked')) {
        return 'CORS error detected. Please check server configuration.';
      }
      if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        return 'Network connectivity issue. Please check your internet connection.';
      }
    }
    return 'Please check your internet connection and try again.';
  }

  _getServerUrls() {
    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
    
    this._log(`Detecting environment: ${currentHost} (localhost: ${isLocalhost})`);
    
    if (isLocalhost) {
      return [
        'http://localhost:3000',
        'https://biometricov4.onrender.com'
      ];
    } else {
      return [
        'https://biometricov4.onrender.com'
      ];
    }
  }

  async testConnection() {
    const servers = this._getServerUrls();
    const results = [];
    
    for (const serverUrl of servers) {
      try {
        const startTime = Date.now();
        const response = await fetch(serverUrl + '/health', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            server: serverUrl,
            status: 'success',
            responseTime,
            data
          });
        } else {
          results.push({
            server: serverUrl,
            status: 'error',
            error: `HTTP ${response.status}`
          });
        }
      } catch (error) {
        results.push({
          server: serverUrl,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }

  async connectToSignaling() {
    const servers = this._getServerUrls();
    
    this._log(`Attempting to connect to ${servers.length} server(s)...`);
    
    for (let i = 0; i < servers.length; i++) {
      const serverUrl = servers[i];
      this._log(`Connection attempt ${i + 1}/${servers.length}: ${serverUrl}`);
      
      try {
        await this._testHttpConnectivity(serverUrl);
        await this._tryConnectToServer(serverUrl);
        
        this._log(`✅ Successfully connected to: ${serverUrl}`);
        this._startHeartbeat();
        return;
        
      } catch (error) {
        this._log(`❌ Failed to connect to ${serverUrl}: ${error.message}`, 'warn');
        
        if (i === servers.length - 1) {
          throw new Error(`Connection timeout`);
        }
        
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
      
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: false,
        timeout: this.config.connectionTimeout,
        forceNew: true,
        reconnection: false,
        autoConnect: true,
        withCredentials: true,
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
        reject(new Error(`Connection timeout`));
      }, this.config.connectionTimeout);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this._log(`✅ Socket.IO connected: ${this.socket.id}`);
        this._setupSocketListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        this._log(`❌ Socket.IO connection error: ${error.message}`, 'error');
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        this._log(`🔌 Socket.IO disconnected: ${reason}`, 'warn');
        
        if (reason !== 'io client disconnect') {
          this._setState('disconnected');
          this._attemptReconnect();
        }
      });

      this.socket.on('connection-confirmed', (data) => {
        this._log(`✅ Connection confirmed by server`);
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
    }, 30000);
    
    this._log('Started heartbeat monitoring');
  }

  _setupSocketListeners() {
    this.socket.on('heartbeat-ack', () => {
      this._log(`💓 Heartbeat acknowledged`);
    });

    this.socket.on('user-joined', (data) => {
      this._log(`👤 User joined: ${JSON.stringify(data)}`);
      this.participants = data.participants || [];
      
      if (this.callbacks.onParticipantsChange) {
        this.callbacks.onParticipantsChange(this.participants);
      }

      // Si tenemos stream local y hay otros participantes, iniciar conexión
      if (this.localStream && this.participants.length > 1) {
        this._log('🚀 Multiple participants detected, starting connection process');
        setTimeout(() => {
          this._initiatePeerConnection();
        }, 1000);
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
        this._log(`📥 Received offer from ${data.from}`);
        await this._handleOffer(data.offer, data.from);
      }
    });

    this.socket.on('answer', async (data) => {
      if (data.from !== this.socket.id) {
        this._log(`📥 Received answer from ${data.from}`);
        await this._handleAnswer(data.answer);
      }
    });

    this.socket.on('ice-candidate', async (data) => {
      if (data.from !== this.socket.id) {
        this._log(`🧊 Received ICE candidate from ${data.from}`);
        await this._handleIceCandidate(data.candidate);
      }
    });

    // 🔧 FIXED: Socket.IO streaming simplificado
    this.socket.on('stream-frame', (data) => {
      if (data.from !== this.socket.id && data.roomId === this.roomId) {
        this._handleSocketStreamFrame(data);
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

      if (!this.socket || !this.socket.connected) {
        this._log('Socket not connected, attempting to connect...');
        await this.connectToSignaling();
      }

      if (!this.socket || !this.socket.connected) {
        throw new Error('Unable to establish connection to signaling server');
      }

      this._log(`Sending join-room request...`);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Room join timeout'));
        }, 10000);

        this.socket.emit('join-room', { 
          roomId, 
          userName 
        });

        const onUserJoined = (data) => {
          this._log(`Received user-joined event: ${JSON.stringify(data)}`);
          
          if (data.participants && data.participants.includes(userName)) {
            clearTimeout(timeout);
            this.socket.off('user-joined', onUserJoined);
            this._log(`✅ Successfully joined room ${roomId}`);
            this.participants = data.participants;
            resolve();
          }
        };

        this.socket.on('user-joined', onUserJoined);
        
        // Fallback - resolve after a short delay if no explicit confirmation
        setTimeout(() => {
          clearTimeout(timeout);
          this.socket.off('user-joined', onUserJoined);
          this._log(`✅ Assuming room join successful (fallback)`);
          resolve();
        }, 3000);
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
    this._log('🎥 Adding local stream to ConnectionManager');
    this.localStream = stream;

    // Log stream details
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    this._log(`   Video tracks: ${videoTracks.length}`);
    this._log(`   Audio tracks: ${audioTracks.length}`);

    // Notify server about media readiness
    if (this.socket && this.socket.connected && this.roomId) {
      this._log('📡 Notifying server about media readiness');
      this.socket.emit('media-ready', {
        roomId: this.roomId,
        mediaInfo: {
          hasVideo: videoTracks.length > 0,
          hasAudio: audioTracks.length > 0,
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length
        }
      });
    }

    // If there are other participants, start connection immediately
    if (this.participants.length > 1) {
      this._log(`🚀 Other participants present (${this.participants.length}), starting connection`);
      await this._initiatePeerConnection();
    } else {
      this._log(`⏳ Waiting for other participants (current: ${this.participants.length})`);
      // 🔧 FIXED: Cambiar estado a media_ready en lugar de socket_streaming
      this._setState('media_ready');
    }

    return { success: true };
  }

  async _initiatePeerConnection() {
    this._log('🔗 Initiating peer connection...');
    
    try {
      // Try WebRTC first
      await this._tryNativeWebRTC();
      this._log('✅ WebRTC connection initiated');
    } catch (error) {
      this._log('❌ WebRTC failed, using Socket.IO streaming fallback', 'warn');
      this._useSocketStreamingFallback();
    }
  }

  async _tryNativeWebRTC() {
    this._log('🔧 Setting up native WebRTC...');
    
    // Clean up existing connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10
    });

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this._log(`➕ Adding ${track.kind} track to peer connection`);
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Event listeners
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this._log('✅ Received remote stream via WebRTC');
      this.remoteStream = remoteStream;
      this._setState('peer_connected');
      
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(remoteStream);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.socket.connected) {
        this._log('📤 Sending ICE candidate');
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          roomId: this.roomId
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this._log(`🔗 Peer connection state: ${state}`);
      
      if (state === 'connected') {
        this._log('✅ WebRTC peer connection established');
        this._setState('peer_connected');
      } else if (state === 'failed' || state === 'disconnected') {
        this._log('❌ WebRTC connection failed, using Socket.IO fallback', 'warn');
        this._useSocketStreamingFallback();
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      this._log(`🧊 ICE gathering state: ${this.peerConnection.iceGatheringState}`);
    };

    this.peerConnection.onsignalingstatechange = () => {
      this._log(`📡 Signaling state: ${this.peerConnection.signalingState}`);
    };

    // Create offer if we should initiate
    const shouldCreateOffer = this.isHost || this.participants.indexOf(this.userName) === 0;
    
    if (shouldCreateOffer) {
      this._log('🚀 Creating offer (we are initiator)');
      await this._createOffer();
    } else {
      this._log('⏳ Waiting for offer from peer');
    }
  }

  async _createOffer() {
    try {
      this._log('📤 Creating WebRTC offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('offer', { 
        offer, 
        roomId: this.roomId 
      });
      
      this._log('✅ Offer sent successfully');
    } catch (error) {
      this._log(`❌ Error creating offer: ${error.message}`, 'error');
      throw error;
    }
  }

  async _handleOffer(offer, fromId) {
    try {
      this._log(`📥 Handling offer from ${fromId}`);
      
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
      
      this._log('✅ Answer sent successfully');
    } catch (error) {
      this._log(`❌ Error handling offer: ${error.message}`, 'error');
      this._useSocketStreamingFallback();
    }
  }

  async _handleAnswer(answer) {
    try {
      this._log('📥 Handling answer');
      
      if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(answer);
        this._log('✅ Answer handled successfully');
      } else {
        this._log('⚠️ Cannot handle answer - invalid signaling state');
      }
    } catch (error) {
      this._log(`❌ Error handling answer: ${error.message}`, 'error');
    }
  }

  async _handleIceCandidate(candidate) {
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(candidate);
        this._log('✅ ICE candidate added');
      } else {
        this._log('⚠️ Cannot add ICE candidate - no remote description');
      }
    } catch (error) {
      this._log(`❌ Error handling ICE candidate: ${error.message}`, 'error');
    }
  }

  // 🔧 FIXED: Socket.IO streaming simplificado (sin CanvasRenderer por ahora)
  async _useSocketStreamingFallback() {
    this._log('🔄 Using Socket.IO streaming fallback');
    this._setState('socket_streaming');

    if (!this.localStream) {
      this._log('❌ No local stream for Socket.IO streaming');
      return;
    }

    try {
      // Crear elementos básicos para captura
      this._setupBasicCapture();
      
      // Iniciar captura de frames
      this._startFrameCapture();

    } catch (error) {
      this._log(`❌ Error setting up Socket.IO streaming: ${error.message}`, 'error');
    }
  }

  _setupBasicCapture() {
    // Crear video element oculto para captura
    this.localVideo = document.createElement('video');
    this.localVideo.srcObject = this.localStream;
    this.localVideo.autoplay = true;
    this.localVideo.playsInline = true;
    this.localVideo.muted = true;
    this.localVideo.style.display = 'none';
    document.body.appendChild(this.localVideo);

    // Crear canvas para captura
    this.localCanvas = document.createElement('canvas');
    this.localCanvas.width = 320;
    this.localCanvas.height = 240;
    this.localCanvas.style.display = 'none';
    document.body.appendChild(this.localCanvas);

    this._log('✅ Basic capture elements created');
  }

  _startFrameCapture() {
    // Limpiar intervalo anterior
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
    }

    this._log('📸 Starting frame capture for Socket.IO streaming');

    // Capturar frames cada 500ms (2 FPS)
    this.streamingInterval = setInterval(async () => {
      if (this.connectionState !== 'socket_streaming' || !this.socket?.connected) {
        this._log('⏹️ Stopping frame capture - conditions not met');
        clearInterval(this.streamingInterval);
        return;
      }

      try {
        const frameData = this._captureFrame();
        
        if (frameData) {
          // Enviar frame
          this.socket.emit('stream-frame', {
            roomId: this.roomId,
            frame: frameData,
            timestamp: Date.now()
          });

          this.frameCount++;
          
          // Log cada 10 frames para no saturar
          if (this.frameCount % 10 === 0) {
            this._log(`📤 Sent ${this.frameCount} frames via Socket.IO`);
          }
        }
      } catch (error) {
        this._log(`❌ Error capturing frame: ${error.message}`, 'error');
      }
    }, 500); // 2 FPS
  }

  _captureFrame() {
    if (!this.localVideo || !this.localCanvas || this.localVideo.readyState < 2) {
      return null;
    }

    const ctx = this.localCanvas.getContext('2d');
    if (!ctx) return null;

    try {
      ctx.clearRect(0, 0, this.localCanvas.width, this.localCanvas.height);
      ctx.drawImage(this.localVideo, 0, 0, this.localCanvas.width, this.localCanvas.height);
      return this.localCanvas.toDataURL('image/jpeg', 0.6);
    } catch (error) {
      this._log(`❌ Error in _captureFrame: ${error.message}`, 'error');
      return null;
    }
  }

  async _handleSocketStreamFrame(data) {
    try {
      // Crear canvas remoto si no existe
      if (!this.remoteCanvas) {
        this._log('🖼️ Creating remote canvas for received frames');
        
        this.remoteCanvas = document.createElement('canvas');
        this.remoteCanvas.width = 320;
        this.remoteCanvas.height = 240;
        this.remoteCanvas.style.display = 'none';
        document.body.appendChild(this.remoteCanvas);

        // Crear stream desde canvas
        const stream = this.remoteCanvas.captureStream(2);
        this.remoteStream = stream;
        
        if (this.callbacks.onRemoteStream) {
          this.callbacks.onRemoteStream(stream);
        }
      }

      // Renderizar frame
      const success = await this._renderFrame(data.frame);
      
      if (success) {
        this.lastFrameTime = Date.now();
        
        // Log cada 10 frames recibidos
        if (this.frameCount % 10 === 0) {
          this._log(`📥 Received and rendered frame via Socket.IO`);
        }
      }

    } catch (error) {
      this._log(`❌ Error handling socket stream frame: ${error.message}`, 'error');
    }
  }

  _renderFrame(frameData) {
    return new Promise((resolve) => {
      if (!this.remoteCanvas || !frameData) {
        resolve(false);
        return;
      }

      const ctx = this.remoteCanvas.getContext('2d');
      if (!ctx) {
        resolve(false);
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        try {
          ctx.clearRect(0, 0, this.remoteCanvas.width, this.remoteCanvas.height);
          ctx.drawImage(img, 0, 0, this.remoteCanvas.width, this.remoteCanvas.height);
          resolve(true);
        } catch (error) {
          this._log(`❌ Error drawing frame: ${error.message}`, 'error');
          resolve(false);
        }
      };

      img.onerror = () => {
        resolve(false);
      };

      img.src = frameData;
    });
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this._log('❌ Max reconnection attempts reached', 'error');
      this._setState('error');
      this._handleError(new Error('Unable to reconnect after multiple attempts'), 'reconnection');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * this.reconnectAttempts;
    
    this._log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.config.reconnectAttempts} in ${delay}ms`);
    
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
        this._log(`❌ Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`, 'error');
        this._attemptReconnect();
      }
    }, delay);
  }

  _clearRemoteStream() {
    this._log('🧹 Clearing remote stream');
    
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
      serverUrl: this.socket ? this.socket.io.uri : null,
      frameCount: this.frameCount,
      lastFrameTime: this.lastFrameTime,
      streamingActive: !!this.streamingInterval
    };
  }

  cleanup() {
    this._log('🧹 Cleaning up ConnectionManager...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }

    // Limpiar elementos DOM
    if (this.localVideo) {
      this.localVideo.pause();
      this.localVideo.srcObject = null;
      if (this.localVideo.parentNode) {
        this.localVideo.parentNode.removeChild(this.localVideo);
      }
      this.localVideo = null;
    }

    if (this.localCanvas && this.localCanvas.parentNode) {
      this.localCanvas.parentNode.removeChild(this.localCanvas);
      this.localCanvas = null;
    }

    if (this.remoteCanvas && this.remoteCanvas.parentNode) {
      this.remoteCanvas.parentNode.removeChild(this.remoteCanvas);
      this.remoteCanvas = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
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