```javascript
/**
 * ENHANCED VIDEO CALL MANAGER - GUEST CONNECTION FIXED + SCAN NOTIFICATIONS
 * 
 * PROBLEMAS IDENTIFICADOS Y SOLUCIONADOS:
 * 1. ✅ GUEST no puede conectarse al servidor (timeout/error)
 * 2. ✅ Problemas de signaling entre HOST y GUEST
 * 3. ✅ ICE candidates no se intercambian correctamente
 * 4. ✅ Peer connection falla en establecerse
 * 5. ✅ Mejor manejo de errores específicos para GUEST
 * 6. ✅ Fallbacks automáticos cuando WebRTC falla
 * 7. ✅ Diagnóstico completo de conectividad
 * 8. ✅ Notificaciones de escaneo (face/hand) para todos los participantes
 * 
 * @author SecureCall Team
 * @version 7.1.0 - SCAN NOTIFICATIONS ADDED
 */

import { io } from 'socket.io-client';

class EnhancedVideoCallManager {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isHost = false;
        this.roomId = null;
        this.userName = null;
        this.connectionState = 'idle';
        
        // 🔧 CRITICAL: Callbacks para UI
        this.callbacks = {
            onLocalStream: null,
            onRemoteStream: null,
            onStateChange: null,
            onParticipantsChange: null,
            onError: null,
            onScanNotification: null // 📢 AÑADIDO: Callback para notificaciones de escaneo
        };
        
        // 🔧 FIXED: Configuración mejorada para guests
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            connectionTimeout: 30000,
            mediaTimeout: 45000,
            iceTimeout: 20000,
            signalingTimeout: 15000,
            maxRetries: 5,
            retryDelay: 2000
        };
        
        this.connectionAttempts = 0;
        this.lastError = null;
        this.participants = [];
        this.isConnecting = false;
        this.mediaReady = false;
        
        this.diagnostics = {
            serverReachable: false,
            socketConnected: false,
            roomJoined: false,
            mediaGranted: false,
            peerConnected: false,
            iceConnected: false
        };
        
        this.debugMode = true;
        this.heartbeatInterval = null;
        this.connectionMonitor = null;
    }

    _log(message, level = 'info') {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            const role = this.isHost ? 'HOST' : 'GUEST';
            console[level](`[${role} ${timestamp}] ${message}`);
        }
    }

    _setState(newState, data = null) {
        const oldState = this.connectionState;
        this.connectionState = newState;
        
        this._log(`State: ${oldState} → ${newState}${data ? ` (${JSON.stringify(data)})` : ''}`);
        
        if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange(newState, oldState, data);
        }
    }

    _handleError(error, context = '', recoverable = true) {
        this.lastError = { error, context, recoverable, timestamp: Date.now() };
        this._log(`❌ Error in ${context}: ${error.message}`, 'error');
        
        if (this.callbacks.onError) {
            this.callbacks.onError({
                message: error.message,
                context,
                recoverable,
                isGuest: !this.isHost,
                diagnostics: this.diagnostics,
                suggestions: this._getErrorSuggestions(error, context)
            });
        }
    }

    _getErrorSuggestions(error, context) {
        const suggestions = [];
        
        if (context === 'server_connection') {
            suggestions.push('Check your internet connection');
            suggestions.push('The server may be starting up - wait 30 seconds and try again');
            suggestions.push('Try refreshing the page');
        } else if (context === 'media_access') {
            suggestions.push('Click "Allow" when prompted for camera/microphone access');
            suggestions.push('Check camera permissions in browser settings');
            suggestions.push('Close other apps using the camera (Zoom, Teams, etc.)');
            suggestions.push('Try using a different browser (Chrome recommended)');
        } else if (context === 'peer_connection') {
            suggestions.push('Check your firewall settings');
            suggestions.push('Try connecting from a different network');
            suggestions.push('The other participant may have connection issues');
        }
        
        return suggestions;
    }

    async runConnectivityDiagnostic() {
        this._log('🔍 Running comprehensive connectivity diagnostic...');
        
        const results = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            location: {
                protocol: window.location.protocol,
                hostname: window.location.hostname,
                port: window.location.port
            },
            webrtc: {
                supported: !!(window.RTCPeerConnection && navigator.mediaDevices),
                getUserMediaSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                secureContext: window.isSecureContext
            },
            server: {
                reachable: false,
                responseTime: null,
                error: null
            },
            media: {
                permissionState: 'unknown',
                devicesAvailable: false,
                error: null
            }
        };

        try {
            const serverUrl = this._getServerUrl();
            const startTime = Date.now();
            
            const response = await fetch(`${serverUrl}/health`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });
            
            results.server.responseTime = Date.now() - startTime;
            results.server.reachable = response.ok;
            
            if (response.ok) {
                const data = await response.json();
                results.server.data = data;
                this.diagnostics.serverReachable = true;
            }
        } catch (error) {
            results.server.error = error.message;
            this.diagnostics.serverReachable = false;
        }

        try {
            const permissions = await navigator.permissions.query({ name: 'camera' });
            results.media.permissionState = permissions.state;
            
            if (permissions.state !== 'denied') {
                const devices = await navigator.mediaDevices.enumerateDevices();
                results.media.devicesAvailable = devices.some(d => d.kind === 'videoinput');
            }
        } catch (error) {
            results.media.error = error.message;
        }

        this._log('🔍 Diagnostic results:', 'info');
        this._log(JSON.stringify(results, null, 2));
        
        return results;
    }

    _getServerUrl() {
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        return isLocalhost ? 
            'http://localhost:3000' : 
            'https://biometricov4.onrender.com';
    }

    async connectToSignaling() {
        if (this.isConnecting) {
            this._log('⚠️ Already connecting to signaling server');
            return;
        }

        this.isConnecting = true;
        this.connectionAttempts++;
        
        try {
            this._setState('connecting_signaling');
            this._log(`🔗 Connecting to signaling server (attempt ${this.connectionAttempts}/${this.config.maxRetries})`);

            if (this.connectionAttempts === 1) {
                await this.runConnectivityDiagnostic();
            }

            const serverUrl = this._getServerUrl();
            this._log(`📡 Server URL: ${serverUrl}`);

            await this._establishSocketConnection(serverUrl);
            
            this.diagnostics.socketConnected = true;
            this._setState('signaling_connected');
            this._log('✅ Successfully connected to signaling server');
            
            this._startHeartbeat();
            
        } catch (error) {
            this.diagnostics.socketConnected = false;
            this._handleError(error, 'server_connection');
            
            if (this.connectionAttempts < this.config.maxRetries) {
                this._log(`🔄 Retrying connection in ${this.config.retryDelay}ms...`);
                setTimeout(() => {
                    this.isConnecting = false;
                    this.connectToSignaling();
                }, this.config.retryDelay);
            } else {
                this._setState('connection_failed');
                throw new Error(`Failed to connect after ${this.config.maxRetries} attempts: ${error.message}`);
            }
        } finally {
            this.isConnecting = false;
        }
    }

    async _establishSocketConnection(serverUrl) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout - server may be starting up'));
            }, this.config.connectionTimeout);

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
                reconnection: true,
                reconnectionAttempts: 3,
                reconnectionDelay: 2000,
                autoConnect: true,
                withCredentials: false,
                extraHeaders: {
                    'Origin': window.location.origin,
                    'User-Agent': navigator.userAgent
                },
                query: {
                    'client-type': 'webrtc-enhanced',
                    'role': this.isHost ? 'host' : 'guest',
                    'timestamp': Date.now(),
                    'attempt': this.connectionAttempts
                }
            });

            this.socket.on('connect', () => {
                clearTimeout(timeout);
                this._log(`✅ Socket connected: ${this.socket.id}`);
                this._setupSocketEvents();
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                this._log(`❌ Socket connection error: ${error.message}`, 'error');
                reject(error);
            });

            this.socket.on('disconnect', (reason) => {
                this._log(`🔌 Socket disconnected: ${reason}`, 'warn');
                this.diagnostics.socketConnected = false;
                
                if (reason !== 'io client disconnect') {
                    this._setState('disconnected');
                }
            });

            this.socket.on('reconnect', (attemptNumber) => {
                this._log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
                this.diagnostics.socketConnected = true;
            });
        });
    }

    _setupSocketEvents() {
        this.socket.on('connection-confirmed', (data) => {
            this._log(`✅ Connection confirmed: ${data.message}`);
        });

        this.socket.on('user-joined', (data) => {
            this._log(`👤 User joined: ${JSON.stringify(data)}`);
            this.participants = data.participants || [];
            
            if (this.callbacks.onParticipantsChange) {
                this.callbacks.onParticipantsChange(this.participants);
            }

            if (this.isHost && this.participants.length > 1 && this.mediaReady) {
                setTimeout(() => this._initiatePeerConnection(), 1000);
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

        // 📢 AÑADIDO: Manejo de notificaciones de escaneo
        this.socket.on('scan-notification', (notification) => {
            this._log(`📢 Received scan notification: ${JSON.stringify(notification)}`);
            if (this.callbacks.onScanNotification && notification.from !== this.socket.id) {
                this.callbacks.onScanNotification(notification);
            }
        });

        this.socket.on('heartbeat-ack', () => {
            this._log('💓 Heartbeat acknowledged');
        });
    }

    _startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat', { 
                    timestamp: Date.now(),
                    role: this.isHost ? 'host' : 'guest',
                    roomId: this.roomId
                });
            }
        }, 30000);
    }

    async joinRoom(roomId, userName) {
        try {
            this._setState('joining_room');
            this._log(`🚪 Joining room: ${roomId} as ${userName}`);

            if (!this.socket || !this.socket.connected) {
                throw new Error('Not connected to signaling server');
            }

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Room join timeout'));
                }, this.config.signalingTimeout);

                this.socket.emit('join-room', { 
                    roomId, 
                    userName,
                    role: this.isHost ? 'host' : 'guest',
                    timestamp: Date.now()
                });

                const onUserJoined = (data) => {
                    if (data.participants && data.participants.includes(userName)) {
                        clearTimeout(timeout);
                        this.socket.off('user-joined', onUserJoined);
                        this.participants = data.participants;
                        this.diagnostics.roomJoined = true;
                        this._log(`✅ Successfully joined room with ${this.participants.length} participants`);
                        resolve();
                    }
                };

                this.socket.on('user-joined', onUserJoined);
            });

            this._setState('room_joined');

        } catch (error) {
            this.diagnostics.roomJoined = false;
            this._handleError(error, 'room_join');
            throw error;
        }
    }

    async setupLocalMedia() {
        try {
            this._setState('requesting_media');
            this._log('🎥 Setting up local media...');

            if (!window.isSecureContext && 
                window.location.protocol !== 'https:' && 
                !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
                throw new Error('HTTPS required for camera access');
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Browser does not support camera access');
            }

            try {
                const permissions = await navigator.permissions.query({ name: 'camera' });
                if (permissions.state === 'denied') {
                    throw new Error('Camera access denied by user');
                }
            } catch (permError) {
                this._log('Cannot check permissions directly, proceeding...', 'warn');
            }

            const constraintSets = [
                {
                    video: {
                        width: { ideal: 640, min: 320, max: 1280 },
                        height: { ideal: 480, min: 240, max: 720 },
                        frameRate: { ideal: 15, min: 10, max: 30 },
                        facingMode: 'user'
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                },
                {
                    video: {
                        width: { ideal: 320, min: 160 },
                        height: { ideal: 240, min: 120 },
                        frameRate: { ideal: 10, min: 5 }
                    },
                    audio: true
                },
                {
                    video: true,
                    audio: true
                },
                {
                    video: true,
                    audio: false
                }
            ];

            let stream = null;
            let lastError = null;

            for (let i = 0; i < constraintSets.length; i++) {
                try {
                    this._log(`Trying media constraints set ${i + 1}/${constraintSets.length}`);
                    stream = await navigator.mediaDevices.getUserMedia(constraintSets[i]);
                    
                    const videoTracks = stream.getVideoTracks();
                    const audioTracks = stream.getAudioTracks();
                    
                    this._log(`✅ Media obtained: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
                    
                    if (videoTracks.length > 0) {
                        const settings = videoTracks[0].getSettings();
                        this._log(`Video: ${settings.width}x${settings.height}@${settings.frameRate}fps`);
                    }
                    
                    break;
                } catch (error) {
                    lastError = error;
                    this._log(`Constraints set ${i + 1} failed: ${error.message}`, 'warn');
                    
                    if (error.name === 'NotAllowedError') {
                        break;
                    }
                }
            }

            if (!stream) {
                throw lastError || new Error('Failed to obtain media stream');
            }

            this.localStream = stream;
            this.mediaReady = true;
            this.diagnostics.mediaGranted = true;

            if (this.callbacks.onLocalStream) {
                this.callbacks.onLocalStream(stream);
            }

            this._setState('media_ready');
            this._log('✅ Local media setup completed');

            return stream;

        } catch (error) {
            this.diagnostics.mediaGranted = false;
            this._handleError(error, 'media_access');
            throw error;
        }
    }

    async _initiatePeerConnection() {
        try {
            this._setState('creating_peer_connection');
            this._log('🔗 Creating peer connection...');

            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            this.peerConnection = new RTCPeerConnection({
                iceServers: this.config.iceServers,
                iceCandidatePoolSize: 10,
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });

            this._setupPeerConnectionEvents();

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this._log(`➕ Adding ${track.kind} track`);
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }

            if (this.isHost) {
                await this._createOffer();
            }

            this._setState('peer_connection_created');

        } catch (error) {
            this._handleError(error, 'peer_connection');
            throw error;
        }
    }

    _setupPeerConnectionEvents() {
        this.peerConnection.ontrack = (event) => {
            this._log('📹 Remote track received');
            const [remoteStream] = event.streams;
            this.remoteStream = remoteStream;
            
            if (this.callbacks.onRemoteStream) {
                this.callbacks.onRemoteStream(remoteStream);
            }
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket && this.socket.connected) {
                this._log('📤 Sending ICE candidate');
                this.socket.emit('ice-candidate', {
                    roomId: this.roomId,
                    candidate: event.candidate
                });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            this._log(`🔗 Peer connection state: ${state}`);
            
            if (state === 'connected') {
                this.diagnostics.peerConnected = true;
                this._setState('peer_connected');
            } else if (state === 'failed') {
                this.diagnostics.peerConnected = false;
                this._log('Peer connection failed, attempting restart...', 'warn');
                setTimeout(() => this._initiatePeerConnection(), 2000);
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            this._log(`🧊 ICE connection state: ${state}`);
            
            if (state === 'connected' || state === 'completed') {
                this.diagnostics.iceConnected = true;
            } else if (state === 'failed') {
                this.diagnostics.iceConnected = false;
                this._log('ICE connection failed, restarting ICE...', 'warn');
                this.peerConnection.restartIce();
            }
        };
    }

    async _createOffer() {
        try {
            this._log('📤 Creating offer...');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('offer', {
                roomId: this.roomId,
                offer: offer
            });
            
            this._log('✅ Offer sent');
        } catch (error) {
            this._handleError(error, 'create_offer');
        }
    }

    async _handleOffer(offer, fromId) {
        try {
            this._log(`📥 Handling offer from ${fromId}`);
            
            if (!this.peerConnection) {
                await this._initiatePeerConnection();
            }
            
            await this.peerConnection.setRemoteDescription(offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', {
                roomId: this.roomId,
                answer: answer
            });
            
            this._log('✅ Answer sent');
        } catch (error) {
            this._handleError(error, 'handle_offer');
        }
    }

    async _handleAnswer(answer) {
        try {
            this._log('📥 Handling answer');
            
            if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
                await this.peerConnection.setRemoteDescription(answer);
                this._log('✅ Answer processed');
            }
        } catch (error) {
            this._handleError(error, 'handle_answer');
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
            this._log(`❌ Error adding ICE candidate: ${error.message}`, 'error');
        }
    }

    _clearRemoteStream() {
        if (this.remoteStream) {
            this.remoteStream = null;
            if (this.callbacks.onRemoteStream) {
                this.callbacks.onRemoteStream(null);
            }
        }
    }

    // 📢 AÑADIDO: Enviar notificación de escaneo
    async sendScanNotification(notification) {
        try {
            if (!this.socket || !this.socket.connected) {
                throw new Error('Not connected to signaling server');
            }
            this._log(`📢 Sending scan notification: ${JSON.stringify(notification)}`);
            this.socket.emit('scan-notification', {
                roomId: this.roomId,
                notification: {
                    ...notification,
                    from: this.socket.id
                }
            });
            return true;
        } catch (error) {
            this._log(`❌ Failed to send scan notification: ${error.message}`, 'error');
            throw error;
        }
    }

    async initialize(roomId, userName, isHost, callbacks = {}) {
        try {
            this._log(`🚀 Initializing as ${isHost ? 'HOST' : 'GUEST'}`);
            
            this.roomId = roomId;
            this.userName = userName;
            this.isHost = isHost;
            this.callbacks = { ...this.callbacks, ...callbacks };
            
            await this.connectToSignaling();
            await this.joinRoom(roomId, userName);
            await this.setupLocalMedia();
            
            if (this.participants.length > 1) {
                await this._initiatePeerConnection();
            }
            
            this._setState('ready');
            this._log('✅ Initialization completed successfully');
            
            return this;
            
        } catch (error) {
            this._setState('error');
            this._handleError(error, 'initialization');
            throw error;
        }
    }

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

    getDebugInfo() {
        return {
            connectionState: this.connectionState,
            isHost: this.isHost,
            roomId: this.roomId,
            userName: this.userName,
            participants: this.participants,
            connectionAttempts: this.connectionAttempts,
            hasLocalStream: !!this.localStream,
            hasRemoteStream: !!this.remoteStream,
            isSocketConnected: this.socket && this.socket.connected,
            peerConnectionState: this.peerConnection ? this.peerConnection.connectionState : 'none',
            iceConnectionState: this.peerConnection ? this.peerConnection.iceConnectionState : 'none',
            diagnostics: this.diagnostics,
            lastError: this.lastError,
            mediaReady: this.mediaReady,
            serverUrl: this._getServerUrl()
        };
    }

    cleanup() {
        this._log('🧹 Cleaning up...');

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
            this.connectionMonitor = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
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
        this._setState('idle');
        
        this._log('✅ Cleanup completed');
    }
}

let enhancedVideoCallManager = null;

export async function initializeEnhancedVideoCall(roomId, userName, isHost, callbacks = {}) {
    try {
        console.log('🚀 Starting Enhanced VideoCallManager...');
        
        if (enhancedVideoCallManager) {
            enhancedVideoCallManager.cleanup();
        }
        
        enhancedVideoCallManager = new EnhancedVideoCallManager();
        await enhancedVideoCallManager.initialize(roomId, userName, isHost, callbacks);
        
        return enhancedVideoCallManager;
        
    } catch (error) {
        console.error('❌ Failed to start enhanced video call:', error);
        throw error;
    }
}

export function getEnhancedDebugInfo() {
    return enhancedVideoCallManager ? enhancedVideoCallManager.getDebugInfo() : {
        error: 'Enhanced VideoCallManager not initialized'
    };
}

export function toggleEnhancedVideo() {
    return enhancedVideoCallManager ? enhancedVideoCallManager.toggleVideo() : false;
}

export function toggleEnhancedAudio() {
    return enhancedVideoCallManager ? enhancedVideoCallManager.toggleAudio() : false;
}

export function cleanupEnhancedVideoCall() {
    if (enhancedVideoCallManager) {
        enhancedVideoCallManager.cleanup();
        enhancedVideoCallManager = null;
    }
}

export default EnhancedVideoCallManager;
```

#### Cambios en `enhancedVideoCallManager.js`:
1. **Añadido `onScanNotification` al objeto `callbacks`**: Se incluye en el constructor para soportar el callback de notificaciones de escaneo.
2. **Añadida función `sendScanNotification`**:
   - Emite un evento `scan-notification` a través de Socket.IO con el `roomId` y la notificación, incluyendo el `from` para identificar al remitente.
   - Verifica que el socket esté conectado antes de enviar.
   - Registra logs para confirmar el envío o reportar errores.
3. **Añadido manejador de `scan-notification` en `_setupSocketEvents`**:
   - Escucha el evento `scan-notification` desde el servidor.
   - Dispara el callback `onScanNotification` solo si la notificación no proviene del propio cliente (`from !== this.socket.id`).
4. **Versión actualizada**: Cambié la versión a `7.1.0` para reflejar la adición de notificaciones de escaneo.

#### 2. Actualizar `EnhancedWebRTCRoom.tsx`
Eliminaremos la simulación local de notificaciones (agregada anteriormente para pruebas) y confiaremos en la transmisión real a través del servidor de señalización. Aquí está la versión actualizada, manteniendo solo los métodos relevantes para el escaneo.

<xaiArtifact artifact_id="98efbd3a-9e78-4e07-a519-01fd7fca2c68" artifact_version_id="c2e263de-f011-4d1a-9df4-129406ba08ef" title="EnhancedWebRTCRoom.tsx" contentType="text/typescript">
```typescript
// ... (importaciones y código previo sin cambios)

const EnhancedWebRTCRoom: React.FC<EnhancedWebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
  // ... (refs, estados y otros métodos sin cambios)

  // Escaneo facial
  const handleFaceScan = () => {
    if (faceScanning) return;
    
    setFaceScanning(true);
    console.log('🔍 Starting face scan animation...');
    
    if (enhancedManagerRef.current && enhancedManagerRef.current.sendScanNotification) {
      console.log('📢 SCAN: Sending face scan notification');
      enhancedManagerRef.current.sendScanNotification({
        type: 'face_scan',
        message: `${userName} está escaneando tu rostro`,
        duration: 5000
      }).catch((err: any) => {
        console.error('❌ SCAN: Failed to send face scan notification:', err);
      });
    } else {
      console.error('❌ SCAN: sendScanNotification not available');
    }
    
    setTimeout(() => {
      setFaceScanning(false);
      console.log('✅ Face scan animation completed');
    }, 5000);
  };

  // Escaneo de mano
  const handleHandScan = () => {
    if (handScanning) return;
    
    setHandScanning(true);
    console.log('👋 Starting hand scan animation...');
    
    if (enhancedManagerRef.current && enhancedManagerRef.current.sendScanNotification) {
      console.log('📢 SCAN: Sending hand scan notification');
      enhancedManagerRef.current.sendScanNotification({
        type: 'hand_scan',
        message: `${userName} está escaneando tu mano`,
        duration: 5000
      }).catch((err: any) => {
        console.error('❌ SCAN: Failed to send hand scan notification:', err);
      });
    } else {
      console.error('❌ SCAN: sendScanNotification not available');
    }
    
    setTimeout(() => {
      setHandScanning(false);
      console.log('✅ Hand scan animation completed');
    }, 5000);
  };

  // ... (resto del código sin cambios)
};

// ... (export default sin cambios)
```

#### Cambios en `EnhancedWebRTCRoom.tsx`:
1. **Eliminada la simulación local**: Quité las llamadas a `handleScanNotification` dentro de `handleFaceScan` y `handleHandScan`, ya que ahora confiamos en la transmisión real a través del servidor de señalización.
2. **Mantiene el manejo de errores**: Conserva los logs y el manejo de errores para `sendScanNotification`.
3. **Sin cambios en la UI**: La renderización de notificaciones (`receivedNotification`) ya está correcta y no necesita modificaciones.

#### 3. Actualizar el Servidor de Señalización
El servidor de señalización debe manejar el evento `scan-notification` y retransmitirlo a todos los participantes en la sala, excepto al remitente. Dado que usas Socket.IO y el servidor está alojado en `https://biometricov4.onrender.com`, aquí está el código necesario para el servidor (agrega esto a tu archivo del servidor, e.g., `server.js`):

```javascript
// server.js
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Ajusta según tus necesidades de seguridad
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, userName, role, timestamp }) => {
    socket.join(roomId);
    console.log(`${userName} (${role}) joined room ${roomId}`);

    const room = io.sockets.adapter.rooms.get(roomId);
    const participants = room ? Array.from(room).map(id => {
      const clientSocket = io.sockets.sockets.get(id);
      return clientSocket.handshake.query['user-name'] || id;
    }) : [userName];

    io.to(roomId).emit('user-joined', { participants, userName });
  });

  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('scan-notification', ({ roomId, notification }) => {
    console.log(`Broadcasting scan notification to room ${roomId}:`, notification);
    socket.to(roomId).emit('scan-notification', notification);
  });

  socket.on('heartbeat', (data) => {
    socket.emit('heartbeat-ack');
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Actualizar lista de participantes en todas las salas del socket
    const rooms = socket.rooms;
    rooms.forEach(roomId => {
      if (roomId !== socket.id) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const participants = room ? Array.from(room).map(id => {
          const clientSocket = io.sockets.sockets.get(id);
          return clientSocket.handshake.query['user-name'] || id;
        }) : [];
        io.to(roomId).emit('user-left', { participants });
      }
    });
  });
});

// Endpoint de salud para diagnóstico
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### Cambios en el servidor:
1. **Evento `scan-notification`**:
   - Escucha el evento `scan-notification` y lo retransmite a todos los participantes en la sala (`roomId`) usando `socket.to(roomId).emit`.
   - Incluye el campo `from` para que el cliente receptor pueda filtrar notificaciones propias.
2. **CORS**: Configurado para permitir conexiones desde cualquier origen (`*`), pero ajusta esto según tus necesidades de seguridad.
3. **Mantenimiento de participantes**: Asegura que la lista de participantes se actualice correctamente al unirse o salir usuarios.

### Pasos para Verificar
1. **Actualiza los archivos**:
   - Reemplaza `enhancedVideoCallManager.js` con el código proporcionado.
   - Actualiza `EnhancedWebRTCRoom.tsx` eliminando la simulación local.
   - Asegúrate de que el servidor en `https://biometricov4.onrender.com` tenga el código actualizado o implementa el servidor localmente si estás en desarrollo (`http://localhost:3000`).

2. **Prueba la conexión**:
   - Abre dos navegadores (o dispositivos) y únete a la misma sala (`roomId`).
   - Verifica en la consola del cliente iniciador:
     - `📢 SCAN: Sending [face/hand] scan notification` al hacer clic en los botones de escaneo.
     - No debería aparecer `❌ SCAN: sendScanNotification not available`.
   - En el cliente remoto, busca:
     - `📢 Received scan notification: {...}` en la consola.
     - La notificación visual en el centro de la pantalla con el mensaje (e.g., "[userName] está escaneando tu rostro").
   - Revisa el panel de depuración (`Show Enhanced Debug`) en el cliente remoto y verifica que "Notification" muestre los detalles de la notificación recibida.

3. **Inspecciona el servidor**:
   - Si usas `https://biometricov4.onrender.com`, asegúrate de que el servidor esté actualizado con el código proporcionado.
   - Localmente, ejecuta el servidor con `node server.js` y verifica los logs para confirmar que recibe y retransmite el evento `scan-notification`.
   - Ejemplo de log esperado en el servidor:
     ```
     Broadcasting scan notification to room [roomId]: { type: 'face_scan', message: '[userName] está escaneando tu rostro', duration: 5000, from: '[socketId]' }
     ```

4. **Depura problemas**:
   - **Si no ves la notificación en el cliente remoto**:
     - Revisa la consola del cliente remoto para errores como `❌ Error in ...`.
     - Confirma que el estado de conexión es `peer_connected` y que `diagnostics.socketConnected` es `true` en ambos clientes.
     - Verifica en el servidor si el evento `scan-notification` llega y se retransmite.
   - **Si el servidor no recibe el evento**:
     - Asegúrate de que el cliente está conectado al servidor correcto (`http://localhost:3000` o `https://biometricov4.onrender.com`).
     - Revisa la configuración de CORS y las conexiones WebSocket en DevTools (Network > WS).
   - **Si la notificación aparece localmente pero no remotamente**:
     - El servidor podría no estar retransmitiendo correctamente. Verifica los logs del servidor.
     - Confirma que ambos clientes están en la misma `roomId`.

5. **Prueba con múltiples participantes**:
   - Une más de dos clientes a la sala y verifica que todos los participantes (excepto el iniciador) reciban la notificación.

### Notas Adicionales
- **Dependencias del servidor**: Asegúrate de que el servidor tenga instaladas las dependencias `express` y `socket.io`:
  ```bash
  npm install express socket.io
  ```
- **Seguridad**: Si el servidor está en producción (`https://biometricov4.onrender.com`), ajusta la configuración de CORS para permitir solo orígenes confiables (e.g., tu dominio de frontend).
- **Tiempo de notificación**: El `duration: 5000` asegura que la notificación sea visible durante 5 segundos. Puedes ajustarlo si necesitas más o menos tiempo.
- **WebRTC Data Channel como alternativa**: Si prefieres usar el canal de datos WebRTC en lugar de Socket.IO para las notificaciones, puedo proporcionar una implementación alternativa. Sin embargo, Socket.IO es más simple y confiable para este caso, ya que ya lo usas para la señalización.

### Si el Problema Persiste
- **Comparte logs**:
  - Del cliente iniciador: Busca `📢 SCAN: Sending ...` y cualquier error.
  - Del cliente remoto: Busca `📢 Received scan notification` y verifica el panel de depuración.
  - Del servidor: Confirma que el evento `scan-notification` se recibe y retransmite.
- **Verifica el servidor**: Si usas `https://biometricov4.onrender.com`, asegúrate de que el código del servidor esté actualizado. Si es un servidor de terceros, comparte detalles sobre su configuración.
- **Prueba localmente**: Configura el servidor localmente (`http://localhost:3000`) para descartar problemas con el entorno de producción.

Con estas actualizaciones, las notificaciones de escaneo deberían aparecer en el centro de la pantalla del cliente remoto. ¡Prueba y dime cómo va! Si necesitas ayuda con el servidor o ves errores específicos, comparte los detalles y lo resolveremos.