import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface WebRTCRoomProps {
  userName: string;
  roomId: string;
  onEndCall: () => void;
}

const WebRTCRoom: React.FC<WebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showDebug, setShowDebug] = useState(true);
  const [initializationStep, setInitializationStep] = useState<string>('Starting...');
  const [isInitialized, setIsInitialized] = useState(false);
  const [serverAttempt, setServerAttempt] = useState(0);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRoom = useRef(false);
  const initializationAttempts = useRef(0);
  const initializationTimeout = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null);

  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => `${prev}\n[${timestamp}] ${message}`);
    console.log(`[DEBUG] ${message}`);
  }, []);

  // 🔧 SOLUCIÓN 1: Lista de servidores de respaldo
  const signalingServers = [
    'wss://biometricov4.onrender.com',
    'wss://securecall-signaling.onrender.com',
    'ws://localhost:3000' // Fallback para desarrollo
  ];

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      setInitializationStep('Starting WebRTC initialization...');
      initializeWebRTC();
    }
    
    return () => {
      cleanup();
    };
  }, [roomId, isInitialized]);

  useEffect(() => {
    initializationTimeout.current = setTimeout(() => {
      if (cameraStatus === 'loading') {
        addDebugInfo('⏰ Initialization timeout reached');
        setError('Initialization took too long. Please try refreshing the page.');
        setCameraStatus('error');
        setInitializationStep('Initialization timeout');
      }
    }, 20000); // Aumentado a 20 segundos

    return () => {
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
      }
    };
  }, [cameraStatus]);

  const initializeWebRTC = async () => {
    try {
      initializationAttempts.current++;
      setCameraStatus('loading');
      setInitializationStep('Checking environment...');
      addDebugInfo(`🚀 Initializing WebRTC (attempt ${initializationAttempts.current})`);
      addDebugInfo(`🌍 Environment: ${window.location.hostname}`);
      addDebugInfo(`🔒 Protocol: ${window.location.protocol}`);
      
      if (!window.isSecureContext) {
        throw new Error('Secure context required for camera access');
      }
      addDebugInfo('✅ Secure context confirmed');
      setInitializationStep('Secure context confirmed');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }
      addDebugInfo('✅ getUserMedia API available');
      setInitializationStep('Media API available');
      
      setInitializationStep('Requesting permissions...');
      await requestMediaPermissions();
      
      setInitializationStep('Getting camera access...');
      const stream = await getUserMediaWithFallback();
      
      setLocalStream(stream);
      addDebugInfo(`✅ Media stream obtained: ${stream.getTracks().length} tracks`);
      setInitializationStep('Media stream obtained');
      
      setInitializationStep('Setting up local video...');
      setupLocalVideoAsync(stream);
      
      // 🔧 SOLUCIÓN 2: Intentar conectar a múltiples servidores
      setInitializationStep('Connecting to signaling servers...');
      await connectToSignalingServerWithFallback();
      
      setInitializationStep('Initializing peer connection...');
      initializePeerConnection(stream);
      
      setInitializationStep('WebRTC ready');
      
    } catch (err: any) {
      console.error('Error initializing WebRTC:', err);
      addDebugInfo(`❌ Initialization failed: ${err.message}`);
      setCameraStatus('error');
      setInitializationStep(`Error: ${err.message}`);
      
      let errorMessage = 'Failed to access camera/microphone. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Camera/microphone access was denied. Please allow permissions and refresh the page.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found. Please connect a camera and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera is being used by another application. Please close other apps and try again.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied. Trying with basic settings...';
        if (initializationAttempts.current < 3) {
          setTimeout(() => {
            setInitializationStep('Retrying with basic settings...');
            initializeWebRTC();
          }, 2000);
          return;
        }
      } else if (err.message.includes('Secure context')) {
        errorMessage += 'HTTPS is required for camera access. Please use a secure connection.';
      } else {
        errorMessage += `Technical error: ${err.message}`;
      }
      
      setError(errorMessage);
    }
  };

  const requestMediaPermissions = async () => {
    try {
      addDebugInfo('🔐 Requesting media permissions...');
      
      if ('permissions' in navigator) {
        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          addDebugInfo(`📹 Camera permission: ${cameraPermission.state}`);
          addDebugInfo(`🎤 Microphone permission: ${micPermission.state}`);
          
          if (cameraPermission.state === 'denied' || micPermission.state === 'denied') {
            throw new Error('Camera or microphone permissions denied. Please allow permissions in your browser settings.');
          }
        } catch (permErr) {
          addDebugInfo('⚠️ Permission query not supported, proceeding with getUserMedia');
        }
      }
      
      try {
        addDebugInfo('🧪 Testing basic media access...');
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 }, 
          audio: true 
        });
        addDebugInfo('✅ Basic media access test successful');
        testStream.getTracks().forEach(track => track.stop());
      } catch (testErr: any) {
        addDebugInfo(`❌ Basic media access test failed: ${testErr.name}`);
        throw testErr;
      }
      
    } catch (err: any) {
      addDebugInfo(`❌ Permission request failed: ${err.message}`);
      throw err;
    }
  };

  const getUserMediaWithFallback = async (): Promise<MediaStream> => {
    const constraints = [
      {
        video: { 
          width: { ideal: 1280, max: 1920 }, 
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      },
      {
        video: { 
          width: { ideal: 640, max: 1280 }, 
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 },
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
          width: { ideal: 320, max: 640 }, 
          height: { ideal: 240, max: 480 },
          frameRate: { ideal: 15, max: 30 }
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
      },
      {
        video: false,
        audio: true
      }
    ];

    for (let i = 0; i < constraints.length; i++) {
      try {
        addDebugInfo(`🎯 Trying constraints ${i + 1}/${constraints.length}`);
        const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
        
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        addDebugInfo(`✅ Success! Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);
        
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];
          const settings = videoTrack.getSettings();
          addDebugInfo(`📹 Video: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
        }
        
        if (audioTracks.length > 0) {
          const audioTrack = audioTracks[0];
          const settings = audioTrack.getSettings();
          addDebugInfo(`🎤 Audio: ${settings.sampleRate}Hz, ${settings.channelCount} channels`);
        }
        
        return stream;
      } catch (err: any) {
        addDebugInfo(`❌ Constraints ${i + 1} failed: ${err.name} - ${err.message}`);
        if (i === constraints.length - 1) {
          throw err;
        }
      }
    }
    
    throw new Error('Failed to get media stream with any constraints');
  };

  const setupLocalVideoAsync = (stream: MediaStream) => {
    addDebugInfo('📺 Starting async local video setup...');
    setCameraStatus('active');
    
    const attemptVideoSetup = (attempt: number = 1) => {
      if (attempt > 20) {
        addDebugInfo('⚠️ Video element setup timeout, but stream is active');
        return;
      }
      
      if (localVideoRef.current) {
        addDebugInfo(`✅ Video ref available on attempt ${attempt}, setting up video...`);
        setupLocalVideo(stream).then(() => {
          addDebugInfo('✅ Local video setup completed');
        }).catch((err) => {
          addDebugInfo(`⚠️ Video setup error: ${err.message}, but continuing...`);
        });
      } else {
        addDebugInfo(`🔍 Video ref not ready (attempt ${attempt}/20), retrying...`);
        setTimeout(() => attemptVideoSetup(attempt + 1), 100);
      }
    };
    
    attemptVideoSetup();
  };

  const setupLocalVideo = async (stream: MediaStream): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!localVideoRef.current) {
        const error = 'Local video ref not available';
        addDebugInfo(`❌ ${error}`);
        reject(new Error(error));
        return;
      }

      const video = localVideoRef.current;
      addDebugInfo('📺 Setting up local video element...');
      
      const onLoadedMetadata = () => {
        addDebugInfo(`✅ Local video metadata loaded: ${video.videoWidth}x${video.videoHeight}`);
        video.play().then(() => {
          addDebugInfo('✅ Local video playing successfully');
          resolve();
        }).catch((err) => {
          addDebugInfo(`❌ Error playing local video: ${err.message}`);
          resolve();
        });
      };

      const onError = (err: any) => {
        addDebugInfo(`❌ Local video error: ${err}`);
        reject(new Error('Local video error'));
      };

      const onCanPlay = () => {
        addDebugInfo('✅ Local video can play');
      };

      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.removeEventListener('canplay', onCanPlay);

      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.addEventListener('canplay', onCanPlay, { once: true });

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.controls = false;

      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';

      setTimeout(() => {
        if (video.readyState === 0) {
          addDebugInfo('⚠️ Video not loaded after timeout, forcing play attempt');
          video.play().catch((err) => {
            addDebugInfo(`⚠️ Forced play failed: ${err.message}`);
          });
          resolve();
        }
      }, 3000);
    });
  };

  // 🔧 SOLUCIÓN 3: Conexión con múltiples servidores de respaldo
  const connectToSignalingServerWithFallback = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      let currentServerIndex = serverAttempt;
      let connectionEstablished = false;
      
      const tryNextServer = () => {
        if (connectionEstablished) return;
        
        if (currentServerIndex >= signalingServers.length) {
          addDebugInfo('❌ All signaling servers failed');
          reject(new Error('Failed to connect to any signaling server'));
          return;
        }
        
        const serverUrl = signalingServers[currentServerIndex];
        const isLocalhost = window.location.hostname === 'localhost';
        
        // Skip localhost server if not in development
        if (serverUrl.includes('localhost') && !isLocalhost) {
          currentServerIndex++;
          tryNextServer();
          return;
        }
        
        addDebugInfo(`🛰️ Attempting connection to server ${currentServerIndex + 1}/${signalingServers.length}: ${serverUrl}`);
        setServerAttempt(currentServerIndex);
        
        // Clear any existing connection timeout
        if (connectionTimeout.current) {
          clearTimeout(connectionTimeout.current);
        }
        
        // Set connection timeout for this attempt
        connectionTimeout.current = setTimeout(() => {
          if (!connectionEstablished) {
            addDebugInfo(`⏰ Connection timeout for ${serverUrl}`);
            if (socketRef.current) {
              socketRef.current.disconnect();
              socketRef.current = null;
            }
            currentServerIndex++;
            tryNextServer();
          }
        }, 15000); // 15 segundos por servidor
        
        connectToSignalingServer(serverUrl, () => {
          if (!connectionEstablished) {
            connectionEstablished = true;
            if (connectionTimeout.current) {
              clearTimeout(connectionTimeout.current);
            }
            addDebugInfo(`✅ Successfully connected to ${serverUrl}`);
            resolve();
          }
        }, () => {
          if (!connectionEstablished) {
            addDebugInfo(`❌ Failed to connect to ${serverUrl}`);
            currentServerIndex++;
            setTimeout(tryNextServer, 1000); // Wait 1 second before trying next server
          }
        });
      };
      
      tryNextServer();
    });
  };

  const connectToSignalingServer = (serverUrl: string, onSuccess: () => void, onFailure: () => void) => {
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Allow fallback to polling
      secure: serverUrl.startsWith('wss://'),
      reconnection: false, // We handle reconnection manually
      forceNew: true,
      timeout: 10000, // 10 second timeout per attempt
      upgrade: true,
      rememberUpgrade: false
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      addDebugInfo(`✅ Connected to signaling server: ${serverUrl} (ID: ${socket.id})`);
      setConnectionStatus('connected');
      setInitializationStep('Connected to signaling server');
      onSuccess();
      
      if (!hasJoinedRoom.current && socket.connected) {
        addDebugInfo('🚪 Joining room for the first time...');
        setInitializationStep('Joining room...');
        socket.emit('join-room', { roomId, userName });
        hasJoinedRoom.current = true;
      }
    });

    socket.on('user-joined', (data) => {
      addDebugInfo(`👤 User joined event received: ${JSON.stringify(data)}`);
      setParticipants(data.participants);
      setInitializationStep(`Room joined - ${data.participants.length} participants`);
      if (data.shouldCreateOffer && data.userId !== socket.id) {
        addDebugInfo('📤 Creating offer for new participant');
        setInitializationStep('Creating offer...');
        createOffer();
      }
    });

    socket.on('user-left', (data) => {
      addDebugInfo(`👋 User left event received: ${JSON.stringify(data)}`);
      setParticipants(data.participants);
      setRemoteStream(null);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    socket.on('offer', async (data) => {
      addDebugInfo(`📥 Received offer from: ${data.from}`);
      if (data.from !== socket.id) {
        setInitializationStep('Handling offer...');
        await handleOffer(data.offer);
      }
    });

    socket.on('answer', async (data) => {
      addDebugInfo(`📨 Received answer from: ${data.from}`);
      if (data.from !== socket.id) {
        setInitializationStep('Handling answer...');
        await handleAnswer(data.answer);
      }
    });

    socket.on('ice-candidate', async (data) => {
      addDebugInfo(`🧊 Received ICE candidate from: ${data.from}`);
      if (data.from !== socket.id) {
        await handleIceCandidate(data.candidate);
      }
    });

    socket.on('connect_error', (error) => {
      addDebugInfo(`❌ Socket connection error to ${serverUrl}: ${error.message}`);
      onFailure();
    });

    socket.on('disconnect', (reason) => {
      addDebugInfo(`🔌 Disconnected from ${serverUrl}: ${reason}`);
      setConnectionStatus('disconnected');
      setInitializationStep(`Disconnected: ${reason}`);
      hasJoinedRoom.current = false;
    });
  };

  const initializePeerConnection = (stream: MediaStream) => {
    addDebugInfo('🔗 Initializing peer connection...');
    
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        },
        {
          urls: 'stun:stun1.l.google.com:19302'
        },
        {
          urls: 'stun:stun2.l.google.com:19302'
        },
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
      ]
    });
    
    peerConnectionRef.current = peerConnection;
    
    stream.getTracks().forEach(track => {
      addDebugInfo(`➕ Adding track to peer connection: ${track.kind} (${track.label})`);
      peerConnection.addTrack(track, stream);
    });

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      addDebugInfo(`📺 Received remote stream with ${remoteStream.getTracks().length} tracks`);
      setRemoteStream(remoteStream);
      setInitializationStep('Remote stream received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          addDebugInfo(`⚠️ Remote video play error: ${err.message}`);
        });
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        addDebugInfo('🧊 Sending ICE candidate');
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          roomId
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      addDebugInfo(`🔗 Peer connection state: ${state}`);
      setInitializationStep(`Peer connection: ${state}`);
      
      if (state === 'connected') {
        addDebugInfo('✅ Peer connection established successfully');
        setInitializationStep('Peer connected');
      } else if (state === 'disconnected' || state === 'failed') {
        addDebugInfo('❌ Peer connection lost');
        setInitializationStep('Peer disconnected');
        setRemoteStream(null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      addDebugInfo(`🧊 ICE connection state: ${peerConnection.iceConnectionState}`);
    };

    peerConnection.onicegatheringstatechange = () => {
      addDebugInfo(`🔍 ICE gathering state: ${peerConnection.iceGatheringState}`);
    };
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) {
      addDebugInfo('⚠️ Cannot create offer: peer connection or socket not ready');
      return;
    }
    
    try {
      addDebugInfo('📤 Creating offer...');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      socketRef.current.emit('offer', {
        offer,
        roomId
      });
      addDebugInfo('✅ Offer sent successfully');
    } catch (err: any) {
      addDebugInfo(`❌ Error creating offer: ${err.message}`);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) {
      addDebugInfo('⚠️ Cannot handle offer: peer connection or socket not ready');
      return;
    }
    
    try {
      addDebugInfo('📥 Handling received offer...');
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      socketRef.current.emit('answer', {
        answer,
        roomId
      });
      addDebugInfo('✅ Answer sent successfully');
    } catch (err: any) {
      addDebugInfo(`❌ Error handling offer: ${err.message}`);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      addDebugInfo('⚠️ Cannot handle answer: peer connection not ready');
      return;
    }
    
    try {
      if (peerConnectionRef.current.signalingState === 'stable') {
        addDebugInfo('⚠️ Peer connection already stable, ignoring duplicate answer');
        return;
      }
      
      addDebugInfo('📨 Handling received answer...');
      await peerConnectionRef.current.setRemoteDescription(answer);
      addDebugInfo('✅ Answer handled successfully');
    } catch (err: any) {
      addDebugInfo(`❌ Error handling answer: ${err.message}`);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      addDebugInfo('⚠️ Cannot handle ICE candidate: peer connection not ready');
      return;
    }
    
    try {
      addDebugInfo('🧊 Adding ICE candidate...');
      await peerConnectionRef.current.addIceCandidate(candidate);
      addDebugInfo('✅ ICE candidate added successfully');
    } catch (err: any) {
      addDebugInfo(`❌ Error handling ICE candidate: ${err.message}`);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        addDebugInfo(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        addDebugInfo(`🎤 Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const retryCamera = async () => {
    try {
      setCameraStatus('loading');
      setError(null);
      initializationAttempts.current = 0;
      setServerAttempt(0); // Reset server attempt
      setInitializationStep('Retrying camera...');
      addDebugInfo('🔄 Retrying camera initialization...');
      
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          addDebugInfo(`🛑 Stopped ${track.kind} track`);
        });
      }
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const stream = await getUserMediaWithFallback();
      setLocalStream(stream);
      
      setupLocalVideoAsync(stream);
      
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        for (const sender of senders) {
          if (sender.track) {
            await peerConnectionRef.current.removeTrack(sender);
            addDebugInfo(`➖ Removed ${sender.track.kind} track from peer connection`);
          }
        }
        
        stream.getTracks().forEach(track => {
          peerConnectionRef.current?.addTrack(track, stream);
          addDebugInfo(`➕ Added new ${track.kind} track to peer connection`);
        });
      }
      
      addDebugInfo('✅ Camera retry successful');
      
    } catch (err: any) {
      addDebugInfo(`❌ Camera retry failed: ${err.message}`);
      setCameraStatus('error');
      setInitializationStep(`Retry failed: ${err.message}`);
      setError('Failed to restart camera. Please refresh the page and try again.');
    }
  };

  const retryConnection = async () => {
    try {
      setConnectionStatus('connecting');
      setError(null);
      setServerAttempt(0);
      setInitializationStep('Retrying connection...');
      addDebugInfo('🔄 Retrying signaling server connection...');
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      hasJoinedRoom.current = false;
      
      await connectToSignalingServerWithFallback();
      
      addDebugInfo('✅ Connection retry successful');
      
    } catch (err: any) {
      addDebugInfo(`❌ Connection retry failed: ${err.message}`);
      setConnectionStatus('disconnected');
      setInitializationStep(`Connection retry failed: ${err.message}`);
      setError('Failed to reconnect to signaling server. Please check your internet connection.');
    }
  };

  const cleanup = () => {
    addDebugInfo('🧹 Cleaning up WebRTC resources...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        addDebugInfo(`🛑 Stopped ${track.kind} track`);
      });
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      addDebugInfo('🔒 Peer connection closed');
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      addDebugInfo('🔌 Socket disconnected');
    }
    
    if (initializationTimeout.current) {
      clearTimeout(initializationTimeout.current);
    }
    
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
    }
    
    hasJoinedRoom.current = false;
  };

  const handleEndCall = () => {
    cleanup();
    onEndCall();
  };

  if (error && cameraStatus === 'error') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-4xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <div className="space-x-4 mb-6">
            <button
              onClick={retryCamera}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Camera
            </button>
            <button
              onClick={retryConnection}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </button>
            <button
              onClick={handleEndCall}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
            >
              Return to Dashboard
            </button>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Settings className="h-4 w-4 mr-2" />
              {showDebug ? 'Hide' : 'Show'} Debug Info
            </button>
          </div>
          
          {showDebug && (
            <div className="bg-gray-800 p-4 rounded-lg text-left text-xs max-h-64 overflow-y-auto mb-4">
              <h4 className="text-white font-semibold mb-2">Debug Information:</h4>
              <pre className="text-gray-300 whitespace-pre-wrap">{debugInfo}</pre>
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-400">
            <p className="font-semibold mb-2">Troubleshooting steps:</p>
            <ul className="list-disc list-inside text-left space-y-1">
              <li>Check your internet connection</li>
              <li>Try refreshing the page</li>
              <li>Ensure you're using HTTPS (required for camera access)</li>
              <li>Allow camera and microphone permissions in your browser</li>
              <li>Close other applications that might be using the camera</li>
              <li>Try using a different browser (Chrome, Firefox, Safari)</li>
              <li>Disable browser extensions that might block camera access</li>
              <li>Check if Render servers are accessible from your network</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Video Container */}
      <div className="flex-1 relative">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
        />
        
        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-gray-600">
          {cameraStatus === 'loading' && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-sm">Loading camera...</span>
                <div className="text-xs text-gray-400 mt-1">{initializationStep}</div>
              </div>
            </div>
          )}
          
          {cameraStatus === 'active' && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
          
          {cameraStatus === 'error' && (
            <div className="absolute inset-0 bg-red-900 bg-opacity-50 flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <span className="text-red-300 text-sm">Camera Error</span>
              </div>
            </div>
          )}
          
          {!isVideoEnabled && cameraStatus === 'active' && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-gray-400" />
            </div>
          )}
          
          <div className="absolute top-2 left-2">
            <div className={`w-3 h-3 rounded-full ${
              cameraStatus === 'active' ? 'bg-green-500' :
              cameraStatus === 'loading' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="absolute top-4 left-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            connectionStatus === 'connected' ? 'bg-green-600 text-white' :
            connectionStatus === 'connecting' ? 'bg-yellow-600 text-white' :
            'bg-red-600 text-white'
          }`}>
            {connectionStatus === 'connected' && <span>🔗 Connected (Server {serverAttempt + 1})</span>}
            {connectionStatus === 'connecting' && <span>🔄 Connecting to servers...</span>}
            {connectionStatus === 'disconnected' && (
              <button onClick={retryConnection} className="hover:bg-red-700 px-2 py-1 rounded">
                ❌ Disconnected - Click to retry
              </button>
            )}
          </div>
        </div>

        {/* Initialization Status */}
        <div className="absolute top-16 left-4">
          <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-full text-white text-sm">
            📋 {initializationStep}
          </div>
        </div>

        {/* Participants Count */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-full text-white text-sm flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Debug Toggle */}
        <div className="absolute top-28 left-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="bg-gray-800 bg-opacity-75 px-2 py-1 rounded text-white text-xs hover:bg-opacity-100"
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>

        {/* Debug Info Panel */}
        {showDebug && (
          <div className="absolute top-36 left-4 bg-gray-900 bg-opacity-95 p-3 rounded-lg max-w-md max-h-64 overflow-y-auto">
            <h4 className="text-white font-semibold mb-2 text-sm">Debug Information:</h4>
            <pre className="text-gray-300 text-xs whitespace-pre-wrap">{debugInfo}</pre>
          </div>
        )}

        {/* Server Info */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-full text-white text-xs">
            🛰️ Multi-Server Fallback + 🌐 Google STUN + 🔁 OpenRelay TURN + 🔒 Vercel HTTPS
          </div>
        </div>

        {/* No Remote Stream Message */}
        {!remoteStream && connectionStatus === 'connected' && cameraStatus === 'active' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
            <div className="text-center text-white">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-xl">Waiting for other participants...</p>
              <p className="text-sm text-gray-400 mt-2">Share the room code to invite others</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-center space-x-4">
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full transition-colors ${
            isAudioEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioEnabled ? (
            <Mic className="h-6 w-6 text-white" />
          ) : (
            <MicOff className="h-6 w-6 text-white" />
          )}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors ${
            isVideoEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? (
            <Video className="h-6 w-6 text-white" />
          ) : (
            <VideoOff className="h-6 w-6 text-white" />
          )}
        </button>

        {(cameraStatus === 'error' || connectionStatus === 'disconnected') && (
          <button
            onClick={connectionStatus === 'disconnected' ? retryConnection : retryCamera}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
            title={connectionStatus === 'disconnected' ? 'Retry connection' : 'Retry camera'}
          >
            <RefreshCw className="h-6 w-6 text-white" />
          </button>
        )}

        <button
          onClick={handleEndCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="End call"
        >
          <Phone className="h-6 w-6 text-white transform rotate-135" />
        </button>
      </div>
    </div>
  );
};

export default WebRTCRoom;