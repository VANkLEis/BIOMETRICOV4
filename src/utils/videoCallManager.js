/**
 * SOLUCIÓN COMPLETA PARA WEBRTC Y VIDEO LOCAL
 * 
 * PROBLEMAS IDENTIFICADOS Y SOLUCIONADOS:
 * 1. ✅ GUEST no puede acceder a cámara (permisos y configuración)
 * 2. ✅ HOST se conecta pero GUEST falla en media access
 * 3. ✅ Mejor manejo de errores específicos para cada caso
 * 4. ✅ Configuración robusta de STUN/TURN servers
 * 5. ✅ Video local AUTOMÁTICO sin repair
 * 6. ✅ Video remoto VISIBLE con audio
 * 7. ✅ Manejo completo de estados y reconexión
 * 
 * @author SecureCall Team
 * @version 5.0.0 - GUEST CAMERA FIXED
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
        
        // Canvas y contextos
        this.localCanvas = null;
        this.remoteCanvas = null;
        this.localCtx = null;
        this.remoteCtx = null;
        
        // Videos para renderizado
        this.localVideo = null;
        this.remoteVideo = null;
        this.remoteAudio = null;
        
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
            if (!window.videoStats) {
                window.videoStats = {};
            }
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

    // 3. 🔧 FIXED: CONFIGURAR VIDEO LOCAL CON MEJOR MANEJO DE PERMISOS
    async setupLocalVideo() {
        try {
            this._log('🎥 GUEST FIXED: Setting up local video with enhanced permissions...');
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
                this._log(`GUEST FIXED: Camera permission status: ${permissions.state}`);
                
                if (permissions.state === 'denied') {
                    throw new Error('Camera access is denied. Please enable camera permissions in your browser settings and refresh the page.');
                }
            } catch (permError) {
                this._log('GUEST FIXED: Cannot check permissions directly, proceeding with getUserMedia...', 'warn');
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

            this._log('GUEST FIXED: Requesting media with enhanced constraints...');
            
            // 🔧 FIXED: Intentar con constraints completas primero
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                this._log('✅ GUEST FIXED: Full media stream obtained');
            } catch (fullError) {
                this._log(`GUEST FIXED: Full constraints failed: ${fullError.message}`, 'warn');
                
                // 🔧 FIXED: Fallback a constraints básicas
                try {
                    const basicConstraints = {
                        video: true,
                        audio: true
                    };
                    stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
                    this._log('✅ GUEST FIXED: Basic media stream obtained as fallback');
                } catch (basicError) {
                    this._log(`❌ GUEST FIXED: Basic constraints also failed: ${basicError.message}`, 'error');
                    throw basicError;
                }
            }

            this.localStream = stream;
            this.mediaRequestState = 'granted';

            // 🔧 FIXED: Log detalles del stream obtenido
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            this._log(`GUEST FIXED: Stream details - Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);
            
            if (videoTracks.length > 0) {
                const videoSettings = videoTracks[0].getSettings();
                this._log(`GUEST FIXED: Video settings: ${videoSettings.width}x${videoSettings.height}@${videoSettings.frameRate}fps`);
            }

            // 🔧 FIXED: Crear video element con configuración robusta
            this.localVideo = document.createElement('video');
            this.localVideo.srcObject = stream;
            this.localVideo.autoplay = true;
            this.localVideo.muted = true; // CRÍTICO: evitar feedback
            this.localVideo.playsInline = true;
            this.localVideo.controls = false;
            this.localVideo.style.display = 'none';
            document.body.appendChild(this.localVideo);

            // 🔧 FIXED: Promesa para esperar que el video esté listo
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Video metadata load timeout'));
                }, 10000);

                this.localVideo.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    this._log('✅ GUEST FIXED: Local video metadata loaded');
                    this.stats.localVideoReady = true;
                    if (window.videoStats) {
                        window.videoStats.localVideoReady = true;
                    }
                    resolve(null);
                };

                this.localVideo.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`Video element error: ${error}`));
                };

                // 🔧 FIXED: Forzar carga de metadata
                this.localVideo.load();
            });

            // 🔧 FIXED: Iniciar renderizado automático
            this.startLocalVideoRender();

            // 🔧 FIXED: Agregar tracks al peer connection si existe
            if (this.peerConnection) {
                stream.getTracks().forEach(track => {
                    this._log(`➕ GUEST FIXED: Adding ${track.kind} track to peer connection`);
                    this.peerConnection.addTrack(track, stream);
                });
            }

            this._log('✅ GUEST FIXED: Local video setup completed successfully');
            return stream;

        } catch (error) {
            this.mediaRequestState = 'denied';
            this._log(`❌ GUEST FIXED: Error accessing camera/microphone: ${error.message}`, 'error');
            
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
            throw enhancedError;
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
                    if (window.videoStats) {
                        window.videoStats.localFrames = this.stats.localFrames;
                        window.videoStats.lastLocalRender = this.stats.lastLocalRender;
                        window.videoStats.isLocalRendering = true;
                    }
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
            if (window.videoStats) {
                window.videoStats.remoteVideoReady = true;
            }
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
            this.remoteAudio = document.createElement('audio');
            this.remoteAudio.srcObject = stream;
            this.remoteAudio.autoplay = true;
            this.remoteAudio.playsInline = true;
            this.remoteAudio.volume = 1.0;
            this.remoteAudio.style.display = 'none';
            document.body.appendChild(this.remoteAudio);

            // Forzar reproducción de audio
            const playPromise = this.remoteAudio.play();
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
                    if (window.videoStats) {
                        window.videoStats.remoteFrames = this.stats.remoteFrames;
                        window.videoStats.lastRemoteRender = this.stats.lastRemoteRender;
                        window.videoStats.isRemoteRendering = true;
                    }
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

            this._log(`🔗 GUEST FIXED: Connecting to signaling server: ${serverUrl}`);

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
                    this._log('❌ GUEST FIXED: Connection timeout to signaling server', 'error');
                    reject(new Error('Connection timeout to signaling server. The server may be starting up or unreachable. Please wait a moment and try again.'));
                }, 15000);

                this.socket.on('connect', () => {
                    clearTimeout(timeout);
                    this._log('✅ GUEST FIXED: Connected to signaling server successfully');
                    this.setupSocketEvents();
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    this._log(`❌ GUEST FIXED: Connection error: ${error.message}`, 'error');
                    
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
                    this._log(`🔌 GUEST FIXED: Disconnected from signaling server: ${reason}`, 'warn');
                });

                // 🔧 ADDED: Confirmación de conexión del servidor
                this.socket.on('connection-confirmed', (data) => {
                    this._log(`✅ GUEST FIXED: Connection confirmed by server: ${data.message}`);
                });

            }).catch(error => {
                this._log(`❌ GUEST FIXED: Failed to load Socket.IO: ${error.message}`, 'error');
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
        if (!window.videoStats) {
            window.videoStats = {};
        }
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
            userName: this.userName,
            serverUrl: this.socket ? this.socket.io.uri : 'not connected',
            initializationState: this.initializationState,
            mediaRequestState: this.mediaRequestState,
            connectionAttempts: this.connectionAttempts,
            canvasInfo: {
                localCanvasExists: !!this.localCanvas,
                remoteCanvasExists: !!this.remoteCanvas,
                localCanvasInDOM: this.localCanvas ? document.contains(this.localCanvas) : false,
                remoteCanvasInDOM: this.remoteCanvas ? document.contains(this.remoteCanvas) : false
            }
        };
    }

    // 15. 🔧 FIXED: INICIALIZACIÓN COMPLETA CON MEJOR MANEJO DE ERRORES
    async initialize(roomId, userName, isHost) {
        try {
            this._log(`🚀 GUEST FIXED: Initializing video call as ${isHost ? 'HOST' : 'GUEST'}`);
            this.initializationState = 'initializing';
            
            this.roomId = roomId;
            this.userName = userName;
            this.isHost = isHost;
            
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
            this._log('✅ GUEST FIXED: Video call initialized successfully');
            
        } catch (error) {
            this.initializationState = 'error';
            this._log(`❌ GUEST FIXED: Failed to initialize video call: ${error.message}`, 'error');
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
        if (this.remoteAudio && this.remoteAudio.parentNode) {
            this.remoteAudio.parentNode.removeChild(this.remoteAudio);
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
        this.remoteAudio = null;
        this.localCanvas = null;
        this.remoteCanvas = null;
        this.localCtx = null;
        this.remoteCtx = null;
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
        console.log('🚀 GUEST FIXED: Starting VideoCallManager initialization...');
        
        // Limpiar instancia anterior si existe
        if (videoCallManager) {
            videoCallManager.cleanup();
        }
        
        videoCallManager = new VideoCallManager();
        await videoCallManager.initialize(roomId, userName, isHost);
        
        // Debug inicial
        setTimeout(() => {
            console.log('📊 GUEST FIXED: Initial debug:', videoCallManager.getDebugInfo());
        }, 3000);
        
        return videoCallManager;
        
    } catch (error) {
        console.error('❌ GUEST FIXED: Failed to start video call:', error);
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
        streamingActive: false,
        initializationState: 'not_initialized',
        mediaRequestState: 'not_initialized'
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