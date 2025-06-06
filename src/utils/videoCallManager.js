/**
 * SOLUCIÓN COMPLETA PARA WEBRTC Y VIDEO LOCAL
 * 
 * Esta clase maneja COMPLETAMENTE:
 * 1. ✅ Video local AUTOMÁTICO (sin necesidad de repair)
 * 2. ✅ Video remoto VISIBLE con WebRTC nativo
 * 3. ✅ Audio remoto FUNCIONAL
 * 4. ✅ Canvas elements correctos con IDs
 * 5. ✅ Estados de video ready automáticos
 * 6. ✅ Peer connection robusta con múltiples ICE servers
 * 7. ✅ Manejo completo de errores y reconexión
 * 8. ✅ Debug completo y estadísticas
 * 
 * @author SecureCall Team
 * @version 4.0.0 - COMPLETE SOLUTION
 */

class VideoCallManager {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.socket = null;
        this.isHost = false;
        this.roomId = null;
        
        // Canvas y contextos
        this.localCanvas = null;
        this.remoteCanvas = null;
        this.localCtx = null;
        this.remoteCtx = null;
        
        // Videos ocultos para renderizado
        this.localVideo = null;
        this.remoteVideo = null;
        
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
            production: 'wss://biometricov4.onrender.com' // Backend server, not frontend
        };
        
        this.debugMode = true;
        this.initializeCanvas();
    }

    _log(message, level = 'info') {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            console[level](`[VideoCallManager ${timestamp}] ${message}`);
        }
    }

    // 1. INICIALIZAR CANVAS CORRECTAMENTE
    initializeCanvas() {
        try {
            // Obtener canvas existentes o crearlos
            this.localCanvas = document.getElementById('localCanvas');
            this.remoteCanvas = document.getElementById('remoteCanvas');
            
            if (!this.localCanvas) {
                this._log('Creating local canvas...');
                this.localCanvas = document.createElement('canvas');
                this.localCanvas.id = 'localCanvas';
                this.localCanvas.style.display = 'none';
                document.body.appendChild(this.localCanvas);
            }
            
            if (!this.remoteCanvas) {
                this._log('Creating remote canvas...');
                this.remoteCanvas = document.createElement('canvas');
                this.remoteCanvas.id = 'remoteCanvas';
                this.remoteCanvas.style.display = 'none';
                document.body.appendChild(this.remoteCanvas);
            }
            
            // Configurar contextos
            this.localCtx = this.localCanvas.getContext('2d');
            this.remoteCtx = this.remoteCanvas.getContext('2d');
            
            // Establecer dimensiones
            this.localCanvas.width = 640;
            this.localCanvas.height = 480;
            this.remoteCanvas.width = 640;
            this.remoteCanvas.height = 480;
            
            // Actualizar stats
            this.stats.hasLocalCanvas = true;
            this.stats.hasRemoteCanvas = true;
            
            // Actualizar stats globales
            window.videoStats = {
                ...window.videoStats,
                hasLocalCanvas: true,
                hasRemoteCanvas: true
            };
            
            this._log('✅ Canvas initialized successfully');
            return true;
        } catch (error) {
            this._log(`❌ Error initializing canvas: ${error.message}`, 'error');
            return false;
        }
    }

    // 2. 🔧 FIXED: CONFIGURAR PEER CONNECTION CON NUEVOS STUN/TURN SERVERS
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

        // Manejar stream remoto
        this.peerConnection.ontrack = (event) => {
            this._log('📹 Remote track received');
            this.remoteStream = event.streams[0];
            this.setupRemoteVideo(this.remoteStream);
        };

        return this.peerConnection;
    }

    // 3. CONFIGURAR VIDEO LOCAL CORRECTAMENTE
    async setupLocalVideo() {
        try {
            this._log('🎥 Setting up local video...');
            
            // Verificar permisos primero
            try {
                const permissions = await navigator.permissions.query({name: 'camera'});
                this._log(`Camera permission: ${permissions.state}`);
            } catch (permError) {
                this._log('Cannot check permissions, proceeding...', 'warn');
            }

            // Obtener stream con configuración específica
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 30, max: 30 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this._log('✅ Local stream obtained');

            // Crear video element oculto para capturar frames
            this.localVideo = document.createElement('video');
            this.localVideo.srcObject = this.localStream;
            this.localVideo.autoplay = true;
            this.localVideo.muted = true; // Evitar eco
            this.localVideo.playsInline = true;
            this.localVideo.style.display = 'none';
            document.body.appendChild(this.localVideo);

            // Cuando el video esté listo, iniciar renderizado
            this.localVideo.onloadedmetadata = () => {
                this._log('✅ Local video metadata loaded');
                this.stats.localVideoReady = true;
                window.videoStats.localVideoReady = true;
                this.startLocalVideoRender();
            };

            // Agregar tracks al peer connection
            if (this.peerConnection) {
                this.localStream.getTracks().forEach(track => {
                    this._log(`➕ Adding ${track.kind} track to peer connection`);
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }

            return this.localStream;

        } catch (error) {
            this._log(`❌ Error accessing camera/microphone: ${error.message}`, 'error');
            
            // Manejar diferentes tipos de errores
            if (error.name === 'NotAllowedError') {
                throw new Error('Por favor, permite el acceso a la cámara y micrófono para continuar.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No se encontró cámara o micrófono.');
            } else {
                throw new Error('Error al acceder a los dispositivos: ' + error.message);
            }
        }
    }

    // 4. RENDERIZAR VIDEO LOCAL AUTOMÁTICAMENTE
    startLocalVideoRender() {
        const renderFrame = () => {
            if (this.localVideo && this.localVideo.readyState >= this.localVideo.HAVE_CURRENT_DATA && this.localCtx) {
                try {
                    // Dibujar frame en canvas
                    this.localCtx.drawImage(
                        this.localVideo, 
                        0, 0, 
                        this.localCanvas.width, 
                        this.localCanvas.height
                    );
                    
                    // Actualizar stats
                    this.stats.localFrames++;
                    this.stats.lastLocalRender = Date.now();
                    this.stats.isLocalRendering = true;
                    
                    // Actualizar stats globales
                    window.videoStats.localFrames = this.stats.localFrames;
                    window.videoStats.lastLocalRender = this.stats.lastLocalRender;
                    window.videoStats.isLocalRendering = true;
                } catch (renderError) {
                    // Silenciar errores menores de renderizado
                }
            }
            
            requestAnimationFrame(renderFrame);
        };
        
        renderFrame();
        this._log('✅ Local video rendering started');
    }

    // 5. CONFIGURAR VIDEO REMOTO CON AUDIO
    setupRemoteVideo(stream) {
        this._log('🖼️ Setting up remote video with audio...');
        
        // Crear video element oculto para stream remoto
        this.remoteVideo = document.createElement('video');
        this.remoteVideo.srcObject = stream;
        this.remoteVideo.autoplay = true;
        this.remoteVideo.playsInline = true;
        this.remoteVideo.style.display = 'none';
        document.body.appendChild(this.remoteVideo);

        this.remoteVideo.onloadedmetadata = () => {
            this._log('✅ Remote video metadata loaded');
            this.stats.remoteVideoReady = true;
            window.videoStats.remoteVideoReady = true;
            this.startRemoteVideoRender();
        };

        // Configurar audio remoto separado
        this.setupRemoteAudio(stream);
    }

    // 6. CONFIGURAR AUDIO REMOTO SEPARADO
    setupRemoteAudio(stream) {
        try {
            this._log('🔊 Setting up remote audio...');
            
            // Crear elemento audio separado para audio remoto
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = stream;
            remoteAudio.autoplay = true;
            remoteAudio.playsInline = true;
            remoteAudio.volume = 1.0;
            remoteAudio.style.display = 'none';
            document.body.appendChild(remoteAudio);

            // Forzar reproducción de audio
            const playPromise = remoteAudio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        this._log('✅ Remote audio is playing');
                    })
                    .catch(error => {
                        this._log(`❌ Remote audio play failed: ${error.message}`, 'error');
                    });
            }

        } catch (error) {
            this._log(`❌ Error setting up remote audio: ${error.message}`, 'error');
        }
    }

    // 7. RENDERIZAR VIDEO REMOTO
    startRemoteVideoRender() {
        const renderFrame = () => {
            if (this.remoteVideo && this.remoteVideo.readyState >= this.remoteVideo.HAVE_CURRENT_DATA && this.remoteCtx) {
                try {
                    // Dibujar frame en canvas
                    this.remoteCtx.drawImage(
                        this.remoteVideo, 
                        0, 0, 
                        this.remoteCanvas.width, 
                        this.remoteCanvas.height
                    );
                    
                    // Actualizar stats
                    this.stats.remoteFrames++;
                    this.stats.lastRemoteRender = Date.now();
                    this.stats.isRemoteRendering = true;
                    
                    // Actualizar stats globales
                    window.videoStats.remoteFrames = this.stats.remoteFrames;
                    window.videoStats.lastRemoteRender = this.stats.lastRemoteRender;
                    window.videoStats.isRemoteRendering = true;
                } catch (renderError) {
                    // Silenciar errores menores de renderizado
                }
            }
            
            requestAnimationFrame(renderFrame);
        };
        
        renderFrame();
        this._log('✅ Remote video rendering started');
    }

    // 8. 🔧 FIXED: CONECTAR AL SERVIDOR DE SEÑALIZACIÓN CON MEJOR MANEJO DE ERRORES
    async connectToSignaling() {
        return new Promise((resolve, reject) => {
            const isLocalhost = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1';
            
            // 🔧 FIXED: Usar la URL correcta del backend
            const serverUrl = isLocalhost ? 
                this.serverConfig.development : 
                this.serverConfig.production;

            this._log(`🔗 FIXED: Connecting to signaling server: ${serverUrl}`);

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
                        'timestamp': Date.now()
                    }
                });

                const timeout = setTimeout(() => {
                    this._log('❌ FIXED: Connection timeout to signaling server', 'error');
                    reject(new Error('Connection timeout to signaling server. Please check if the server is running.'));
                }, 15000);

                this.socket.on('connect', () => {
                    clearTimeout(timeout);
                    this._log('✅ FIXED: Connected to signaling server successfully');
                    this.setupSocketEvents();
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    this._log(`❌ FIXED: Connection error: ${error.message}`, 'error');
                    
                    // 🔧 ADDED: Mensajes de error más específicos
                    let errorMessage = 'Failed to connect to signaling server. ';
                    
                    if (error.message.includes('timeout')) {
                        errorMessage += 'The server may be starting up or unreachable.';
                    } else if (error.message.includes('CORS')) {
                        errorMessage += 'CORS policy error. Please check server configuration.';
                    } else if (error.message.includes('NetworkError')) {
                        errorMessage += 'Network connectivity issue. Please check your internet connection.';
                    } else {
                        errorMessage += error.message;
                    }
                    
                    reject(new Error(errorMessage));
                });

                // 🔧 ADDED: Manejo de desconexión
                this.socket.on('disconnect', (reason) => {
                    this._log(`🔌 FIXED: Disconnected from signaling server: ${reason}`, 'warn');
                });

                // 🔧 ADDED: Confirmación de conexión del servidor
                this.socket.on('connection-confirmed', (data) => {
                    this._log(`✅ FIXED: Connection confirmed by server: ${data.message}`);
                });

            }).catch(error => {
                this._log(`❌ FIXED: Failed to load Socket.IO: ${error.message}`, 'error');
                reject(new Error('Failed to load Socket.IO library: ' + error.message));
            });
        });
    }

    // 9. CONFIGURAR EVENTOS DE SOCKET
    setupSocketEvents() {
        // Manejar usuarios que se unen
        this.socket.on('user-joined', (data) => {
            this._log(`👤 User joined: ${JSON.stringify(data)}`);
            
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

    // 10. CREAR Y ENVIAR OFFER (HOST)
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

    // 11. MANEJAR OFFER Y CREAR ANSWER (INVITADO)
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

    // 12. MANEJAR ANSWER (HOST)
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(answer);
            this._log('✅ Answer processed');
        } catch (error) {
            this._log(`❌ Error handling answer: ${error.message}`, 'error');
        }
    }

    // 13. REINICIAR CONEXIÓN EN CASO DE FALLO
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

    // 14. FUNCIÓN DEBUG MEJORADA
    getDebugInfo() {
        // Actualizar stats globales
        window.videoStats = {
            ...window.videoStats,
            ...this.stats
        };

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
            serverUrl: this.socket ? this.socket.io.uri : 'not connected',
            canvasInfo: {
                localCanvasExists: !!this.localCanvas,
                remoteCanvasExists: !!this.remoteCanvas,
                localCanvasInDOM: this.localCanvas ? document.contains(this.localCanvas) : false,
                remoteCanvasInDOM: this.remoteCanvas ? document.contains(this.remoteCanvas) : false
            }
        };
    }

    // 15. INICIALIZACIÓN COMPLETA
    async initialize(roomId, userName, isHost) {
        try {
            this._log(`🚀 FIXED: Initializing video call as ${isHost ? 'HOST' : 'GUEST'}`);
            
            this.roomId = roomId;
            this.isHost = isHost;
            
            // 1. Conectar al servidor de señalización
            await this.connectToSignaling();
            
            // 2. Unirse al room
            await this.joinRoom(roomId, userName);
            
            // 3. Configurar peer connection
            this.createPeerConnection();
            
            // 4. Configurar video local
            await this.setupLocalVideo();
            
            this._log('✅ FIXED: Video call initialized successfully');
            
        } catch (error) {
            this._log(`❌ FIXED: Failed to initialize video call: ${error.message}`, 'error');
            throw error;
        }
    }

    // 16. UNIRSE AL ROOM
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

    // 17. TOGGLE CONTROLES
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

    // 18. LIMPIEZA COMPLETA
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

        // Limpiar elementos DOM
        if (this.localVideo && this.localVideo.parentNode) {
            this.localVideo.parentNode.removeChild(this.localVideo);
        }
        if (this.remoteVideo && this.remoteVideo.parentNode) {
            this.remoteVideo.parentNode.removeChild(this.remoteVideo);
        }
        if (this.localCanvas && this.localCanvas.parentNode) {
            this.localCanvas.parentNode.removeChild(this.localCanvas);
        }
        if (this.remoteCanvas && this.remoteCanvas.parentNode) {
            this.remoteCanvas.parentNode.removeChild(this.remoteCanvas);
        }

        // Reset variables
        this.localVideo = null;
        this.remoteVideo = null;
        this.localCanvas = null;
        this.remoteCanvas = null;
        this.localCtx = null;
        this.remoteCtx = null;
        this.remoteStream = null;

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

        // Reset stats globales
        window.videoStats = { ...this.stats };

        this._log('✅ Cleanup completed');
    }
}

// Instancia global
let videoCallManager = null;

// Función para inicializar desde el código existente
export async function initializeVideoCall(roomId, userName, isHost) {
    try {
        console.log('🚀 FIXED: Starting VideoCallManager initialization...');
        
        // Limpiar instancia anterior si existe
        if (videoCallManager) {
            videoCallManager.cleanup();
        }
        
        videoCallManager = new VideoCallManager();
        await videoCallManager.initialize(roomId, userName, isHost);
        
        // Debug inicial
        setTimeout(() => {
            console.log('📊 FIXED: Initial debug:', videoCallManager.getDebugInfo());
        }, 3000);
        
        return videoCallManager;
        
    } catch (error) {
        console.error('❌ FIXED: Failed to start video call:', error);
        throw error;
    }
}

// Función para obtener debug info
export function getVideoDebugInfo() {
    return videoCallManager ? videoCallManager.getDebugInfo() : { 
        error: 'VideoCallManager not initialized',
        hasLocalCanvas: false,
        hasRemoteCanvas: false,
        localVideoReady: false,
        remoteVideoReady: false,
        frameCount: 0,
        streamingActive: false
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