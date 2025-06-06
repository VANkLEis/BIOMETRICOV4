/**
 * CallManager - Sistema de gestión de estados de llamada con lazy loading de medios
 * 
 * Arquitectura:
 * 1. Conectar al room SIN medios
 * 2. Establecer signaling
 * 3. DESPUÉS solicitar medios con botón explícito
 * 4. Agregar stream a peer connections existentes
 * 
 * Estados: idle → joining → signaling_ready → requesting_media → media_ready → connected
 * 
 * @author SecureCall Team
 * @version 2.0.0
 */

import { io } from 'socket.io-client';
import { getUserMedia, stopStream, setDebugMode } from './mediaManager.js';

class CallManager {
  constructor() {
    this.state = 'idle';
    this.socket = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    
    // Configuración de timeouts
    this.timeouts = {
      connection: 30000,      // 30s para conectar al servidor
      mediaRequest: 30000,    // 30s para permisos de medios
      heartbeat: 3000,        // 3s entre heartbeats
      peerConnection: 15000   // 15s para establecer peer connection
    };
    
    // Estado interno
    this.roomId = null;
    this.userName = null;
    this.participants = [];
    this.isHost = false;
    this.mediaRequestStartTime = null;
    this.heartbeatInterval = null;
    this.connectionTimeout = null;
    this.mediaTimeout = null;
    
    // Callbacks
    this.callbacks = {
      onStateChange: null,
      onParticipantsChange: null,
      onRemoteStream: null,
      onError: null,
      onDebug: null
    };
    
    // Debug
    this.debugMode = false;
    this.debugLog = [];
    
    // Configuración WebRTC
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
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
    ];
  }

  /**
   * Habilita modo debug
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    setDebugMode(enabled);
  }

  /**
   * Log interno con timestamp
   */
  _log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${this.state}] ${message}`;
    
    if (this.debugMode) {
      console[level](logEntry);
    }
    
    this.debugLog.push({ timestamp, state: this.state, message, level });
    
    // Mantener solo los últimos 100 logs
    if (this.debugLog.length > 100) {
      this.debugLog = this.debugLog.slice(-100);
    }
    
    if (this.callbacks.onDebug) {
      this.callbacks.onDebug(logEntry);
    }
  }

  /**
   * Cambia el estado y notifica
   */
  _setState(newState, data = null) {
    const oldState = this.state;
    this.state = newState;
    
    this._log(`State change: ${oldState} → ${newState}${data ? ` (${JSON.stringify(data)})` : ''}`);
    
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(newState, oldState, data);
    }
  }

  /**
   * Maneja errores de forma centralizada
   */
  _handleError(error, context = '') {
    this._log(`Error in ${context}: ${error.message}`, 'error');
    
    if (this.callbacks.onError) {
      this.callbacks.onError({
        message: error.message,
        context,
        state: this.state,
        recoverable: error.recoverable !== false,
        userAction: error.userAction || 'Please try again',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Inicia heartbeat durante solicitud de medios
   */
  _startMediaHeartbeat() {
    this._log('Starting media request heartbeat');
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('media-heartbeat', { 
          roomId: this.roomId,
          state: this.state,
          timestamp: Date.now()
        });
        this._log('Media heartbeat sent');
      }
    }, this.timeouts.heartbeat);
  }

  /**
   * Detiene heartbeat
   */
  _stopMediaHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this._log('Media heartbeat stopped');
    }
  }

  /**
   * Obtiene URL del servidor de señalización
   */
  _getSignalingServerUrl() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    return isLocalhost ? 'ws://localhost:3000' : 'wss://biometricov4.onrender.com';
  }

  /**
   * FASE 1: Conectar al room SIN medios
   */
  async joinRoom(roomId, userName, isHost = false) {
    try {
      this._log(`Starting room join: ${roomId} as ${userName} (host: ${isHost})`);
      this._setState('joining', { roomId, userName, isHost });
      
      this.roomId = roomId;
      this.userName = userName;
      this.isHost = isHost;
      
      // Conectar al servidor de señalización
      await this._connectToSignalingServer();
      
      // Unirse al room
      await this._joinSignalingRoom();
      
      this._setState('signaling_ready');
      this._log('✅ Room joined successfully, ready for media request');
      
      return {
        success: true,
        state: this.state,
        roomId: this.roomId,
        participants: this.participants
      };
      
    } catch (error) {
      this._setState('idle');
      this._handleError(error, 'joinRoom');
      throw error;
    }
  }

  /**
   * Conecta al servidor de señalización
   */
  async _connectToSignalingServer() {
    return new Promise((resolve, reject) => {
      const serverUrl = this._getSignalingServerUrl();
      this._log(`Connecting to signaling server: ${serverUrl}`);
      
      // Timeout de conexión
      this.connectionTimeout = setTimeout(() => {
        reject(new Error('Connection timeout to signaling server'));
      }, this.timeouts.connection);
      
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        secure: serverUrl.startsWith('wss://'),
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        forceNew: true,
        timeout: 20000
      });
      
      this.socket.on('connect', () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        this._log('✅ Connected to signaling server');
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        reject(new Error(`Failed to connect: ${error.message}`));
      });
      
      this.socket.on('disconnect', (reason) => {
        this._log(`Disconnected from signaling server: ${reason}`, 'warn');
        if (this.state !== 'idle') {
          this._setState('disconnected');
        }
      });
      
      // Configurar event listeners
      this._setupSignalingListeners();
    });
  }

  /**
   * Configura listeners del servidor de señalización
   */
  _setupSignalingListeners() {
    this.socket.on('user-joined', (data) => {
      this._log(`User joined: ${JSON.stringify(data)}`);
      this.participants = data.participants || [];
      
      if (this.callbacks.onParticipantsChange) {
        this.callbacks.onParticipantsChange(this.participants);
      }
      
      // Si ya tenemos medios y llega alguien nuevo, crear offer
      if (this.localStream && data.shouldCreateOffer && data.userId !== this.socket.id) {
        this._createOffer();
      }
    });
    
    this.socket.on('user-left', (data) => {
      this._log(`User left: ${JSON.stringify(data)}`);
      this.participants = data.participants || [];
      
      if (this.callbacks.onParticipantsChange) {
        this.callbacks.onParticipantsChange(this.participants);
      }
      
      // Limpiar stream remoto
      this._clearRemoteStream();
    });
    
    this.socket.on('offer', async (data) => {
      if (data.from !== this.socket.id) {
        await this._handleOffer(data.offer);
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
    
    // Eventos específicos para manejo de medios
    this.socket.on('media-request-acknowledged', () => {
      this._log('Media request acknowledged by server');
    });
    
    this.socket.on('peer-media-ready', (data) => {
      this._log(`Peer media ready: ${data.userId}`);
    });
  }

  /**
   * Se une al room de señalización
   */
  async _joinSignalingRoom() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 10000);
      
      this.socket.emit('join-room', { 
        roomId: this.roomId, 
        userName: this.userName 
      });
      
      // Esperar confirmación implícita (user-joined event)
      const onUserJoined = (data) => {
        if (data.participants && data.participants.includes(this.userName)) {
          clearTimeout(timeout);
          this.socket.off('user-joined', onUserJoined);
          this.participants = data.participants;
          resolve();
        }
      };
      
      this.socket.on('user-joined', onUserJoined);
    });
  }

  /**
   * FASE 2: Solicitar medios (requiere interacción del usuario)
   */
  async requestMedia(options = {}) {
    try {
      if (this.state !== 'signaling_ready') {
        throw new Error(`Cannot request media in state: ${this.state}`);
      }
      
      this._log('Starting media request...');
      this._setState('requesting_media');
      
      // Notificar al servidor que estamos solicitando medios
      this.socket.emit('media-request-started', { 
        roomId: this.roomId,
        timestamp: Date.now()
      });
      
      // Iniciar heartbeat para mantener conexión viva
      this._startMediaHeartbeat();
      
      // Configurar timeout para permisos
      this.mediaRequestStartTime = Date.now();
      this.mediaTimeout = setTimeout(() => {
        this._handleMediaTimeout();
      }, this.timeouts.mediaRequest);
      
      // Solicitar medios usando MediaManager
      const mediaResult = await getUserMedia({
        quality: options.quality || 'medium',
        video: options.video !== false,
        audio: options.audio !== false,
        fallbackToAudioOnly: options.fallbackToAudioOnly !== false,
        allowPartialSuccess: options.allowPartialSuccess !== false
      });
      
      // Limpiar timeout
      if (this.mediaTimeout) {
        clearTimeout(this.mediaTimeout);
        this.mediaTimeout = null;
      }
      
      this._stopMediaHeartbeat();
      
      this.localStream = mediaResult.stream;
      
      this._log(`✅ Media obtained: ${mediaResult.description}`);
      this._setState('media_ready', { 
        mediaInfo: mediaResult,
        duration: Date.now() - this.mediaRequestStartTime
      });
      
      // Notificar al servidor que tenemos medios
      this.socket.emit('media-ready', { 
        roomId: this.roomId,
        mediaInfo: {
          hasVideo: mediaResult.hasVideo,
          hasAudio: mediaResult.hasAudio,
          quality: mediaResult.quality,
          isPartial: mediaResult.isPartial
        },
        timestamp: Date.now()
      });
      
      // Inicializar peer connection con medios
      await this._initializePeerConnection();
      
      this._setState('connected');
      
      return {
        success: true,
        stream: this.localStream,
        mediaInfo: mediaResult
      };
      
    } catch (error) {
      this._stopMediaHeartbeat();
      
      if (this.mediaTimeout) {
        clearTimeout(this.mediaTimeout);
        this.mediaTimeout = null;
      }
      
      // Notificar error al servidor
      this.socket.emit('media-error', { 
        roomId: this.roomId,
        error: error.message,
        timestamp: Date.now()
      });
      
      // Volver a estado anterior si es recuperable
      if (error.recoverable !== false) {
        this._setState('signaling_ready');
      } else {
        this._setState('error');
      }
      
      this._handleError(error, 'requestMedia');
      throw error;
    }
  }

  /**
   * Maneja timeout de solicitud de medios
   */
  _handleMediaTimeout() {
    this._log('Media request timeout', 'warn');
    this._stopMediaHeartbeat();
    
    const duration = Date.now() - this.mediaRequestStartTime;
    
    // Notificar timeout al servidor
    this.socket.emit('media-timeout', { 
      roomId: this.roomId,
      duration,
      timestamp: Date.now()
    });
    
    const error = new Error(`Media request timeout after ${duration}ms. User may still be granting permissions.`);
    error.recoverable = true;
    error.userAction = 'Please grant camera/microphone permissions and try again.';
    
    this._setState('signaling_ready');
    this._handleError(error, 'mediaTimeout');
  }

  /**
   * Inicializa peer connection con medios
   */
  async _initializePeerConnection() {
    this._log('Initializing peer connection with media...');
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });
    
    // Agregar tracks locales
    this.localStream.getTracks().forEach(track => {
      this._log(`Adding ${track.kind} track to peer connection`);
      this.peerConnection.addTrack(track, this.localStream);
    });
    
    // Configurar event listeners
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this._log('Received remote stream');
      this.remoteStream = remoteStream;
      
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(remoteStream);
      }
    };
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.socket.connected) {
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          roomId: this.roomId
        });
      }
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this._log(`Peer connection state: ${state}`);
      
      if (state === 'disconnected' || state === 'failed') {
        this._clearRemoteStream();
      }
    };
    
    // Si hay otros participantes, crear offer
    if (this.participants.length > 1) {
      await this._createOffer();
    }
  }

  /**
   * Crea offer para peer connection
   */
  async _createOffer() {
    if (!this.peerConnection || !this.socket || !this.socket.connected) return;
    
    try {
      this._log('Creating offer...');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('offer', { offer, roomId: this.roomId });
      this._log('✅ Offer sent');
    } catch (error) {
      this._log(`Error creating offer: ${error.message}`, 'error');
    }
  }

  /**
   * Maneja offer recibida
   */
  async _handleOffer(offer) {
    if (!this.peerConnection || !this.socket || !this.socket.connected) return;
    
    try {
      this._log('Handling offer...');
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.socket.emit('answer', { answer, roomId: this.roomId });
      this._log('✅ Answer sent');
    } catch (error) {
      this._log(`Error handling offer: ${error.message}`, 'error');
    }
  }

  /**
   * Maneja answer recibida
   */
  async _handleAnswer(answer) {
    if (!this.peerConnection) return;
    
    try {
      if (this.peerConnection.signalingState === 'stable') {
        this._log('Ignoring duplicate answer');
        return;
      }
      
      this._log('Handling answer...');
      await this.peerConnection.setRemoteDescription(answer);
      this._log('✅ Answer handled');
    } catch (error) {
      this._log(`Error handling answer: ${error.message}`, 'error');
    }
  }

  /**
   * Maneja ICE candidate
   */
  async _handleIceCandidate(candidate) {
    if (!this.peerConnection) return;
    
    try {
      await this.peerConnection.addIceCandidate(candidate);
      this._log('✅ ICE candidate added');
    } catch (error) {
      this._log(`Error handling ICE candidate: ${error.message}`, 'error');
    }
  }

  /**
   * Limpia stream remoto
   */
  _clearRemoteStream() {
    if (this.remoteStream) {
      this.remoteStream = null;
      
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(null);
      }
    }
  }

  /**
   * Toggle video track
   */
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this._log(`Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
        return videoTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Toggle audio track
   */
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this._log(`Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
        return audioTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Obtiene estado actual
   */
  getState() {
    return {
      state: this.state,
      roomId: this.roomId,
      userName: this.userName,
      participants: this.participants,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      isConnected: this.socket && this.socket.connected,
      peerConnectionState: this.peerConnection ? this.peerConnection.connectionState : null
    };
  }

  /**
   * Obtiene logs de debug
   */
  getDebugLogs() {
    return this.debugLog;
  }

  /**
   * Configura callbacks
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Limpia y desconecta todo
   */
  cleanup() {
    this._log('Starting cleanup...');
    
    // Limpiar timeouts
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.mediaTimeout) {
      clearTimeout(this.mediaTimeout);
      this.mediaTimeout = null;
    }
    
    this._stopMediaHeartbeat();
    
    // Limpiar streams
    if (this.localStream) {
      stopStream(this.localStream);
      this.localStream = null;
    }
    
    this._clearRemoteStream();
    
    // Cerrar peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Desconectar socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Reset estado
    this._setState('idle');
    this.roomId = null;
    this.userName = null;
    this.participants = [];
    this.isHost = false;
    
    this._log('✅ Cleanup completed');
  }
}

export default CallManager;

/**
 * EJEMPLO DE USO:
 * 
 * import CallManager from './utils/callManager.js';
 * 
 * const callManager = new CallManager();
 * 
 * // Configurar callbacks
 * callManager.setCallbacks({
 *   onStateChange: (newState, oldState, data) => {
 *     console.log(`State: ${oldState} → ${newState}`, data);
 *   },
 *   onParticipantsChange: (participants) => {
 *     console.log('Participants:', participants);
 *   },
 *   onRemoteStream: (stream) => {
 *     if (stream) {
 *       remoteVideo.srcObject = stream;
 *     }
 *   },
 *   onError: (error) => {
 *     console.error('Call error:', error);
 *   }
 * });
 * 
 * // Fase 1: Unirse al room (sin medios)
 * await callManager.joinRoom('room123', 'user1', true);
 * 
 * // Fase 2: Solicitar medios (requiere click del usuario)
 * const result = await callManager.requestMedia({
 *   quality: 'medium',
 *   video: true,
 *   audio: true
 * });
 * 
 * localVideo.srcObject = result.stream;
 */