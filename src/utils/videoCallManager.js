/**
 * SOLUCIÓN COMPLETA PARA WEBRTC Y VIDEO LOCAL
 * 
 * PROBLEMAS IDENTIFICADOS Y SOLUCIONADOS:
 * 1. ✅ GUEST no puede acceder a cámara (permisos y configuración)
 * 2. ✅ HOST se conecta pero GUEST falla en media access
 * 3. ✅ Mejor manejo de errores específicos para cada caso
 * 4. ✅ Configuración robusta de STUN/TURN servers
 * 5. ✅ Video local DIRECTO a elemento <video>
 * 6. ✅ Video remoto DIRECTO a elemento <video>
 * 7. ✅ Audio remoto AUTOMÁTICO
 * 8. ✅ Callbacks para asignación inmediata de streams
 * 
 * @author SecureCall Team
 * @version 6.0.0 - DIRECT VIDEO ASSIGNMENT FIXED
 */

class VideoCallManager {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.socket = null;
        this.isHost = false;
        this.roomId = null;
        this.userName = null;
        
        // 🔧 CRITICAL: Callbacks para asignación directa de streams
        this.callbacks = {
            onLocalStream: null,
            onRemoteStream: null,
            onStateChange: null,
            onParticipantsChange: null,
            onError: null
        };
        
        // Stats para debug
        this.stats = {
            localFrames: 0,
            remoteFrames: 0,
            lastLocalRender: 0,
            lastRemoteRender: 0,
            isLocalRendering: false,
            isRemoteRendering: false,
            hasLocalCanvas: false,
            hasRemoteCanvas: false,
            localVideoReady: false,
            remoteVideoReady: false
        };
        
        // 🔧 FIXED: Configuración de servidor corregida
        this.serverConfig = {
            development: 'ws://localhost:3000',
            production: 'wss://biometricov4.onrender.com' // Backend server correcto
        };
        
        this.debugMode = true;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        
        // 🔧 ADDED: Estados de inicialización
        this.initializationState = 'idle';
        this.mediaRequestState = 'idle';
    }

    _log(message, level = 'info') {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            console[level](`[VideoCallManager ${timestamp}] ${message}`);
        }
    }

    // 🔧 CRITICAL: Configurar callbacks para asignación directa
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
        this._log('✅ CRITICAL: Callbacks configured for direct stream assignment');
    }

    // 🔧 FIXED: CONFIGURAR PEER CONNECTION CON NUEVOS STUN/TURN SERVERS
    createPeerConnection() {
        const configuration = {
            iceServers: [
                // 🔧 UPDATED: Usar los nuevos servidores STUN/TURN especificados
                {
                    urls: "stun:openrelay.metered.ca:80"
                },
                {
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                {
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                {
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                }
            ],
            iceCandidatePoolSize: 10
        };

        this.peerConnection = new RTCPeerConnection(configuration);
        
        // Manejar estado de conexión
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            this._log(`🔗 Peer connection state: ${state}`);
            
            if (this.callbacks.onStateChange) {
                this.callbacks.onStateChange(`peer_${state}`, 'peer_connection', { peerState: state });
            }
            
            if (state === 'failed') {
                this._log('Connection failed, attempting to restart...', 'warn');
                this.restartConnection();
            } else if (state === 'connected') {
                this._log('✅ Peer connection established successfully');
            }
        };

        // Manejar ICE state
        this.peerConnection.oniceconnectionstatechange = () => {
            this._log(`🧊 ICE connection state: ${this.peerConnection.iceConnectionState}`);
            
            if (this.peerConnection.iceConnectionState === 'failed') {
                this._log('ICE connection failed, restarting ICE...', 'warn');
                this.peerConnection.restartIce();
            }
        };

        // Manejar candidatos ICE
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket && this.socket.connected) {
                this._log('📤 Sending ICE candidate');
                this.socket.emit('ice-candidate', {
                    roomId: this.roomId,
                    candidate: event.candidate
                });
            }
        };

        // 🔧 CRITICAL: Manejar stream remoto con callback INMEDIATO
        this.peerConnection.ontrack = (event) => {
            this._log('📹 CRITICAL: Remote track received');
            const [remoteStream] = event.streams;
            this.remoteStream = remoteStream;
            
            // 🔧 CRITICAL: Llamar callback INMEDIATAMENTE para asignación directa
            if (this.callbacks.onRemoteStream) {
                this._log('📹 CRITICAL: Calling onRemoteStream callback for DIRECT assignment');
                this.callbacks.onRemoteStream(remoteStream);
            }
            
            this.stats.remoteVideoReady = true;
        };

        return this.peerConnection;
    }

    // 🔧 FIXED: CONFIGURAR VIDEO LOCAL CON MEJOR MANEJO DE PERMISOS
    async setupLocalVideo() {
        try {
            this._log('🎥 CRITICAL: Setting up local video with DIRECT assignment...');
            this.mediaRequestState = 'requesting';
            
            // 🔧 FIXED: Verificar contexto seguro primero
            if (!window.isSecureContext && window.location.protocol !== 'https:' && 
                window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                throw new Error('HTTPS connection required for camera access. Please use a secure connection.');
            }

            // 🔧 FIXED: Verificar disponibilidad de getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.');
            }

            // 🔧 FIXED: Verificar permisos de forma más robusta
            try {
                const permissions = await navigator.permissions.query({name: 'camera'});
                this._log(`CRITICAL: Camera permission status: ${permissions.state}`);
                
                if (permissions.state === 'denied') {
                    throw new Error('Camera access is denied. Please enable camera permissions in your browser settings and refresh the page.');
                }
            } catch (permError) {
                this._log('CRITICAL: Cannot check permissions directly, proceeding with getUserMedia...', 'warn');
            }

            // 🔧 FIXED: Configuración de constraints más permisiva para guests
            const constraints = {
                video: {
                    width: { ideal: 640, min: 320, max: 1280 },
                    height: { ideal: 480, min: 240, max: 720 },
                    frameRate: { ideal: 15, min: 10, max: 30 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: { ideal: 44100, min: 8000 }
                }
            };

            this._log('CRITICAL: Requesting media with enhanced constraints...');
            
            // 🔧 FIXED: Intentar con constraints completas primero
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                this._log('✅ CRITICAL: Full media stream obtained');
            } catch (fullError) {
                this._log(`CRITICAL: Full constraints failed: ${fullError.message}`, 'warn');
                
                // 🔧 FIXED: Fallback a constraints básicas
                try {
                    const basicConstraints = {
                        video: true,
                        audio: true
                    };
                    stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
                    this._log('✅ CRITICAL: Basic media stream obtained as fallback');
                } catch (basicError) {
                    this._log(`❌ CRITICAL: Basic constraints also failed: ${basicError.message}`, 'error');
                    throw basicError;
                }
            }

            this.localStream = stream;
            this.mediaRequestState = 'granted';

            // 🔧 FIXED: Log detalles del stream obtenido
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            this._log(`CRITICAL: Stream details - Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);
            
            if (videoTracks.length > 0) {
                const videoSettings = videoTracks[0].getSettings();
                this._log(`CRITICAL: Video settings: ${videoSettings.width}x${videoSettings.height}@${videoSettings.frameRate}fps`);
            }

            // 🔧 CRITICAL: Llamar callback INMEDIATAMENTE para asignación directa
            if (this.callbacks.onLocalStream) {
                this._log('🎥 CRITICAL: Calling onLocalStream callback for DIRECT assignment');
                this.callbacks.onLocalStream(stream);
            }

            // 🔧 FIXED: Agregar tracks al peer connection si existe
            if (this.peerConnection) {
                stream.getTracks().forEach(track => {
                    this._log(`➕ CRITICAL: Adding ${track.kind} track to peer connection`);
                    this.peerConnection.addTrack(track, stream);
                });
            }

            this.stats.localVideoReady = true;
            this._log('✅ CRITICAL: Local video setup completed with DIRECT assignment');
            return stream;

        } catch (error) {
            this.mediaRequestState = 'denied';
            this._log(`❌ CRITICAL: Error accessing camera/microphone: ${error.message}`, 'error');
            
            // 🔧 FIXED: Mensajes de error más específicos y útiles
            let userFriendlyMessage;
            
            if (error.name === 'NotAllowedError') {
                userFriendlyMessage = 'Camera and microphone access denied. Please:\n1. Click the camera icon in your browser\'s address bar\n2. Allow camera and microphone access\n3. Refresh the page and try again';
            } else if (error.name === 'NotFoundError') {
                userFriendlyMessage = 'No camera or microphone found. Please:\n1. Connect a camera and microphone to your device\n2. Make sure they are not being used by other applications\n3. Refresh the page and try again';
            } else if (error.name === 'NotReadableError') {
                userFriendlyMessage = 'Camera or microphone is being used by another application. Please:\n1. Close other video calling applications (Zoom, Teams, etc.)\n2. Close other browser tabs using the camera\n3. Refresh the page and try again';
            } else if (error.name === 'OverconstrainedError') {
                userFriendlyMessage = 'Camera settings not supported. Please:\n1. Try using a different camera if available\n2. Update your browser to the latest version\n3. Refresh the page and try again';
            } else if (error.message.includes('HTTPS') || error.message.includes('secure')) {
                userFriendlyMessage = 'Secure connection required. Please:\n1. Make sure you are using HTTPS (secure connection)\n2. If testing locally, use localhost instead of IP address\n3. Contact support if the problem persists';
            } else {
                userFriendlyMessage = `Camera access failed: ${error.message}\n\nPlease:\n1. Check your camera and microphone connections\n2. Grant permissions when prompted\n3. Refresh the page and try again`;
            }
            
            const enhancedError = new Error(userFriendlyMessage);
            enhancedError.originalError = error;
            enhancedError.name = error.name;
            
            // 🔧 CRITICAL: Llamar callback de error
            if (this.callbacks.onError) {
                this.callbacks.onError({
                    message: userFriendlyMessage,
                    originalError: error,
                    context: 'setupLocalVideo'
                });
            }
            
            throw enhancedError;
        }
    }

    // 🔧 FIXED: CONECTAR AL SERVIDOR DE SEÑALIZACIÓN CON MEJOR MANEJO DE ERRORES
    async connectToSignaling() {
        return new Promise((resolve, reject) => {
            const isLocalhost = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1';
            
            // 🔧 FIXED: Usar la URL correcta del backend
            const serverUrl = isLocalhost ? 
                this.serverConfig.development : 
                this.serverConfig.production;

            this._log(`🔗 CRITICAL: Connecting to signaling server: ${serverUrl}`);

            // 🔧 FIXED: Mejor manejo de importación de Socket.IO
            import('socket.io-client').then(({ io }) => {
                this.socket = io(serverUrl, {
                    transports: ['websocket', 'polling'],
                    upgrade: true,
                    rememberUpgrade: false,
                    timeout: 20000,
                    forceNew: true,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 2000,
                    // 🔧 ADDED: Headers adicionales para CORS
                    extraHeaders: {
                        'Origin': window.location.origin
                    },
                    // 🔧 ADDED: Query params para identificación
                    query: {
                        'client-type': 'webrtc-room',
                        'timestamp': Date.now(),
                        'user-role': this.isHost ? 'host' : 'guest'
                    }
                });

                const timeout = setTimeout(() => {
                    this._log('❌ CRITICAL: Connection timeout to signaling server', 'error');
                    reject(new Error('Connection timeout to signaling server. The server may be starting up or unreachable. Please wait a moment and try again.'));
                }, 15000);

                this.socket.on('connect', () => {
                    clearTimeout(timeout);
                    this._log('✅ CRITICAL: Connected to signaling server successfully');
                    this.setupSocketEvents();
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    this._log(`❌ CRITICAL: Connection error: ${error.message}`, 'error');
                    
                    // 🔧 ADDED: Mensajes de error más específicos
                    let errorMessage = 'Failed to connect to signaling server. ';
                    
                    if (error.message.includes('timeout')) {
                        errorMessage += 'The server may be starting up or unreachable. Please wait a moment and try again.';
                    } else if (error.message.includes('CORS')) {
                        errorMessage += 'CORS policy error. Please check server configuration.';
                    } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
                        errorMessage += 'Network connectivity issue. Please check your internet connection and try again.';
                    } else {
                        errorMessage += error.message;
                    }
                    
                    reject(new Error(errorMessage));
                });

                // 🔧 ADDED: Manejo de desconexión
                this.socket.on('disconnect', (reason) => {
                    this._log(`🔌 CRITICAL: Disconnected from signaling server: ${reason}`, 'warn');
                });

                // 🔧 ADDED: Confirmación de conexión del servidor
                this.socket.on('connection-confirmed', (data) => {
                    this._log(`✅ CRITICAL: Connection confirmed by server: ${data.message}`);
                });

            }).catch(error => {
                this._log(`❌ CRITICAL: Failed to load Socket.IO: ${error.message}`, 'error');
                reject(new Error('Failed to load Socket.IO library: ' + error.message));
            });
        });
    }

    // 🔧 CONFIGURAR EVENTOS DE SOCKET
    setupSocketEvents() {
        // Manejar usuarios que se unen
        this.socket.on('user-joined', (data) => {
            this._log(`👤 User joined: ${JSON.stringify(data)}`);
            
            if (this.callbacks.onParticipantsChange) {
                this.callbacks.onParticipantsChange(data.participants || []);
            }
            
            // Si hay otros participantes y tenemos stream local, iniciar conexión
            if (data.participants && data.participants.length > 1 && this.localStream) {
                setTimeout(() => {
                    if (this.isHost) {
                        this.createOffer();
                    }
                }, 1000);
            }
        });

        // Manejar offer (solo invitado)
        this.socket.on('offer', async (data) => {
            if (!this.isHost) {
                this._log('📨 Received offer');
                await this.handleOffer(data.offer);
            }
        });

        // Manejar answer (solo host)
        this.socket.on('answer', async (data) => {
            if (this.isHost) {
                this._log('📨 Received answer');
                await this.handleAnswer(data.answer);
            }
        });

        // Manejar candidatos ICE
        this.socket.on('ice-candidate', async (data) => {
            this._log('📨 Received ICE candidate');
            try {
                if (this.peerConnection && this.peerConnection.remoteDescription) {
                    await this.peerConnection.addIceCandidate(data.candidate);
                }
            } catch (error) {
                this._log(`❌ Error adding ICE candidate: ${error.message}`, 'error');
            }
        });

        this.socket.on('disconnect', () => {
            this._log('🔌 Disconnected from signaling server', 'warn');
        });
    }

    // 🔧 CREAR Y ENVIAR OFFER (HOST)
    async createOffer() {
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
            this._log(`❌ Error creating offer: ${error.message}`, 'error');
        }
    }

    // 🔧 MANEJAR OFFER Y CREAR ANSWER (INVITADO)
    async handleOffer(offer) {
        try {
            await this.peerConnection.setRemoteDescription(offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', {
                roomId: this.roomId,
                answer: answer
            });
            
            this._log('✅ Answer sent');
        } catch (error) {
            this._log(`❌ Error handling offer: ${error.message}`, 'error');
        }
    }

    // 🔧 MANEJAR ANSWER (HOST)
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(answer);
            this._log('✅ Answer processed');
        } catch (error) {
            this._log(`❌ Error handling answer: ${error.message}`, 'error');
        }
    }

    // 🔧 REINICIAR CONEXIÓN EN CASO DE FALLO
    async restartConnection() {
        this._log('🔄 Restarting connection...');
        
        try {
            // Cerrar conexión actual
            if (this.peerConnection) {
                this.peerConnection.close();
            }
            
            // Crear nueva conexión
            this.createPeerConnection();
            
            // Re-agregar tracks locales
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Si es host, crear nueva oferta
            if (this.isHost) {
                await this.createOffer();
            }
            
        } catch (error) {
            this._log(`❌ Error restarting connection: ${error.message}`, 'error');
        }
    }

    // 🔧 FUNCIÓN DEBUG MEJORADA
    getDebugInfo() {
        return {
            hasLocalStream: !!this.localStream,
            hasRemoteStream: !!this.remoteStream,
            isSocketConnected: this.socket ? this.socket.connected : false,
            peerConnectionState: this.peerConnection ? this.peerConnection.connectionState : 'none',
            iceConnectionState: this.peerConnection ? this.peerConnection.iceConnectionState : 'none',
            frameCount: this.stats.localFrames + this.stats.remoteFrames,
            lastFrameTime: Math.max(this.stats.lastLocalRender, this.stats.lastRemoteRender),
            streamingActive: this.stats.isLocalRendering || this.stats.isRemoteRendering,
            videoRendererStats: this.stats,
            isHost: this.isHost,
            roomId: this.roomId,
            userName: this.userName,
            serverUrl: this.socket ? this.socket.io.uri : 'not connected',
            initializationState: this.initializationState,
            mediaRequestState: this.mediaRequestState,
            connectionAttempts: this.connectionAttempts,
            callbacksConfigured: {
                onLocalStream: !!this.callbacks.onLocalStream,
                onRemoteStream: !!this.callbacks.onRemoteStream,
                onStateChange: !!this.callbacks.onStateChange,
                onParticipantsChange: !!this.callbacks.onParticipantsChange,
                onError: !!this.callbacks.onError
            }
        };
    }

    // 🔧 FIXED: INICIALIZACIÓN COMPLETA CON CALLBACKS
    async initialize(roomId, userName, isHost, callbacks = {}) {
        try {
            this._log(`🚀 CRITICAL: Initializing video call as ${isHost ? 'HOST' : 'GUEST'} with DIRECT stream assignment`);
            this.initializationState = 'initializing';
            
            this.roomId = roomId;
            this.userName = userName;
            this.isHost = isHost;
            
            // 🔧 CRITICAL: Configurar callbacks PRIMERO
            this.setCallbacks(callbacks);
            
            // 1. Conectar al servidor de señalización
            this.initializationState = 'connecting_signaling';
            await this.connectToSignaling();
            
            // 2. Unirse al room
            this.initializationState = 'joining_room';
            await this.joinRoom(roomId, userName);
            
            // 3. Configurar peer connection
            this.initializationState = 'creating_peer_connection';
            this.createPeerConnection();
            
            // 4. Configurar video local
            this.initializationState = 'requesting_media';
            await this.setupLocalVideo();
            
            this.initializationState = 'ready';
            this._log('✅ CRITICAL: Video call initialized with DIRECT stream assignment');
            
            return this;
            
        } catch (error) {
            this.initializationState = 'error';
            this._log(`❌ CRITICAL: Failed to initialize video call: ${error.message}`, 'error');
            throw error;
        }
    }

    // 🔧 UNIRSE AL ROOM
    async joinRoom(roomId, userName) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Room join timeout'));
            }, 10000);

            this.socket.emit('join-room', { 
                roomId, 
                userName 
            });

            const onUserJoined = (data) => {
                if (data.participants && data.participants.includes(userName)) {
                    clearTimeout(timeout);
                    this.socket.off('user-joined', onUserJoined);
                    this._log(`✅ Successfully joined room ${roomId}`);
                    resolve();
                }
            };

            this.socket.on('user-joined', onUserJoined);
        });
    }

    // 🔧 TOGGLE CONTROLES
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

    // 🔧 LIMPIEZA COMPLETA
    cleanup() {
        this._log('🧹 Cleaning up VideoCallManager...');

        // Detener streams
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

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

        // Reset variables
        this.remoteStream = null;

        // Reset estados
        this.initializationState = 'idle';
        this.mediaRequestState = 'idle';
        this.connectionAttempts = 0;

        // Reset stats
        this.stats = {
            localFrames: 0,
            remoteFrames: 0,
            lastLocalRender: 0,
            lastRemoteRender: 0,
            isLocalRendering: false,
            isRemoteRendering: false,
            hasLocalCanvas: false,
            hasRemoteCanvas: false,
            localVideoReady: false,
            remoteVideoReady: false
        };

        this._log('✅ Cleanup completed');
    }
}

// Instancia global
let videoCallManager = null;

// 🔧 CRITICAL: Función para inicializar con callbacks
export async function initializeVideoCall(roomId, userName, isHost, callbacks = {}) {
    try {
        console.log('🚀 CRITICAL: Starting VideoCallManager with DIRECT stream assignment...');
        
        // Limpiar instancia anterior si existe
        if (videoCallManager) {
            videoCallManager.cleanup();
        }
        
        videoCallManager = new VideoCallManager();
        await videoCallManager.initialize(roomId, userName, isHost, callbacks);
        
        // Debug inicial
        setTimeout(() => {
            console.log('📊 CRITICAL: Initial debug:', videoCallManager.getDebugInfo());
        }, 3000);
        
        return videoCallManager;
        
    } catch (error) {
        console.error('❌ CRITICAL: Failed to start video call:', error);
        throw error;
    }
}

// Función para obtener debug info
export function getVideoDebugInfo() {
    return videoCallManager ? videoCallManager.getDebugInfo() : { 
        error: 'VideoCallManager not initialized',
        hasLocalStream: false,
        hasRemoteStream: false,
        localVideoReady: false,
        remoteVideoReady: false,
        frameCount: 0,
        streamingActive: false,
        initializationState: 'not_initialized',
        mediaRequestState: 'not_initialized',
        callbacksConfigured: {
            onLocalStream: false,
            onRemoteStream: false,
            onStateChange: false,
            onParticipantsChange: false,
            onError: false
        }
    };
}

// Función para toggle video
export function toggleVideo() {
    return videoCallManager ? videoCallManager.toggleVideo() : false;
}

// Función para toggle audio
export function toggleAudio() {
    return videoCallManager ? videoCallManager.toggleAudio() : false;
}

// Función para cleanup
export function cleanupVideoCall() {
    if (videoCallManager) {
        videoCallManager.cleanup();
        videoCallManager = null;
    }
}

// Exportar la clase para uso directo
export default VideoCallManager;