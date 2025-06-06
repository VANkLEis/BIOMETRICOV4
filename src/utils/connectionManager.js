/**
 * ConnectionManager - Sistema robusto de conexión WebRTC con múltiples fallbacks
 * 
 * Maneja:
 * - Conexión directa WebRTC
 * - Fallback a Simple-Peer
 * - Fallback a Socket.IO streaming
 * - Reconexión automática
 * - Logging detallado
 */

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
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Conecta al servidor de señalización
   */
  async connectToSignaling() {
    return new Promise((resolve, reject) => {
      const serverUrl = this._getServerUrl();
      this._log(`Connecting to signaling server: ${serverUrl}`);
      
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: false,
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.config.reconnectAttempts,
        reconnectionDelay: this.config.reconnectDelay
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this._log('✅ Connected to signaling server');
        this._setupSocketListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        this._log(`Connection error: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  _getServerUrl() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    return isLocalhost ? 'ws://localhost:3000' : 'wss://biometricov4.onrender.com';
  }

  _setupSocketListeners() {
    this.socket.on('user-joined', (data) => {
      this._log(`User joined: ${JSON.stringify(data)}`);
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
      this._log(`User left: ${JSON.stringify(data)}`);
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

    // Fallback: Socket.IO streaming
    this.socket.on('stream-data', (data) => {
      this._handleSocketStream(data);
    });

    this.socket.on('disconnect', () => {
      this._log('Disconnected from signaling server', 'warn');
      this._setState('disconnected');
      this._attemptReconnect();
    });
  }

  /**
   * Se une a un room
   */
  async joinRoom(roomId, userName, isHost = false) {
    try {
      this._setState('joining');
      this.roomId = roomId;
      this.userName = userName;
      this.isHost = isHost;

      if (!this.socket || !this.socket.connected) {
        await this.connectToSignaling();
      }

      this._log(`Joining room: ${roomId} as ${userName}`);
      
      this.socket.emit('join-room', { 
        roomId, 
        userName 
      });

      this._setState('connected');
      return { success: true };

    } catch (error) {
      this._setState('error');
      this._handleError(error, 'joinRoom');
      throw error;
    }
  }

  /**
   * Agrega stream local y inicia conexiones peer
   */
  async addLocalStream(stream) {
    this._log('Adding local stream');
    this.localStream = stream;

    // Si hay otros participantes, iniciar conexión inmediatamente
    if (this.participants.length > 1) {
      await this._initiatePeerConnection();
    }

    return { success: true };
  }

  /**
   * Inicia conexión peer con múltiples fallbacks
   */
  async _initiatePeerConnection() {
    this._log('Initiating peer connection...');
    
    try {
      // Método 1: WebRTC nativo
      await this._tryNativeWebRTC();
    } catch (error) {
      this._log('Native WebRTC failed, trying Simple-Peer fallback', 'warn');
      
      try {
        // Método 2: Simple-Peer fallback
        await this._trySimplePeerFallback();
      } catch (error2) {
        this._log('Simple-Peer failed, using Socket.IO streaming fallback', 'warn');
        
        // Método 3: Socket.IO streaming fallback
        this._useSocketStreamingFallback();
      }
    }
  }

  /**
   * Método 1: WebRTC nativo
   */
  async _tryNativeWebRTC() {
    this._log('Trying native WebRTC...');
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10
    });

    // Agregar tracks locales
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

    // Crear offer si somos el host o el primero en tener medios
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

  /**
   * Método 2: Simple-Peer fallback
   */
  async _trySimplePeerFallback() {
    this._log('Trying Simple-Peer fallback...');
    
    // Importar Simple-Peer dinámicamente
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

    // Listener para señales de Simple-Peer
    this.socket.on('simple-peer-signal', (data) => {
      if (data.roomId === this.roomId) {
        peer.signal(data.signal);
      }
    });

    this.simplePeer = peer;
  }

  /**
   * Método 3: Socket.IO streaming fallback
   */
  _useSocketStreamingFallback() {
    this._log('Using Socket.IO streaming fallback');
    this._setState('socket_streaming');

    if (!this.localStream) return;

    // Configurar captura de frames para streaming
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    
    video.srcObject = this.localStream;
    video.play();

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;

      // Enviar frames cada 100ms (10 FPS)
      const streamInterval = setInterval(() => {
        if (this.connectionState !== 'socket_streaming') {
          clearInterval(streamInterval);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL('image/jpeg', 0.5);
        
        this.socket.emit('stream-frame', {
          roomId: this.roomId,
          frame: frameData,
          timestamp: Date.now()
        });
      }, 100);

      this.streamInterval = streamInterval;
    };

    // Crear video remoto para mostrar frames recibidos
    this._createRemoteVideoForSocketStream();
  }

  _createRemoteVideoForSocketStream() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 240;

    // Convertir canvas a stream
    const stream = canvas.captureStream(10); // 10 FPS
    this.remoteStream = stream;

    if (this.callbacks.onRemoteStream) {
      this.callbacks.onRemoteStream(stream);
    }

    // Listener para frames remotos
    this.socket.on('stream-frame', (data) => {
      if (data.roomId === this.roomId) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = data.frame;
      }
    });

    this._log('✅ Socket.IO streaming established');
  }

  _handleSocketStream(data) {
    // Manejar datos de stream via Socket.IO
    this._log('Received socket stream data');
  }

  /**
   * Reconexión automática
   */
  _attemptReconnect() {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this._log('Max reconnection attempts reached', 'error');
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
      } catch (error) {
        this._log(`Reconnection attempt ${this.reconnectAttempts} failed`, 'error');
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

  /**
   * Configurar callbacks
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Obtener estado actual
   */
  getState() {
    return {
      connectionState: this.connectionState,
      roomId: this.roomId,
      userName: this.userName,
      participants: this.participants,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      isSocketConnected: this.socket && this.socket.connected,
      peerConnectionState: this.peerConnection ? this.peerConnection.connectionState : null
    };
  }

  /**
   * Limpiar recursos
   */
  cleanup() {
    this._log('Cleaning up ConnectionManager...');

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