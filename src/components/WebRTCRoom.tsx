import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Play } from 'lucide-react';
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
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connecting' | 'connected' | 'disconnected'>('waiting');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [cameraStatus, setCameraStatus] = useState<'waiting' | 'loading' | 'active' | 'error'>('waiting');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);
  const [initializationStep, setInitializationStep] = useState<string>('Ready to start');
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
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

  const getSignalingServerUrl = () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      return 'ws://localhost:3000';
    } else {
      return 'wss://biometricov4.onrender.com';
    }
  };

  // 🔧 SOLUCIÓN 1: Solo inicializar tras interacción del usuario
  const handleStartCall = async () => {
    if (hasUserInteracted) return;
    
    setHasUserInteracted(true);
    setCameraStatus('loading');
    setConnectionStatus('connecting');
    setInitializationStep('Starting WebRTC initialization...');
    
    try {
      await initializeWebRTC();
    } catch (err: any) {
      console.error('Error starting call:', err);
      setError(`Failed to start call: ${err.message}`);
      setCameraStatus('error');
      setConnectionStatus('disconnected');
    }
  };

  const initializeWebRTC = async () => {
    try {
      initializationAttempts.current++;
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
      
      // 🔧 SOLUCIÓN 2: Limpiar streams previos antes de solicitar nuevos
      await cleanupPreviousStreams();
      
      setInitializationStep('Getting camera access...');
      const stream = await getUserMediaWithSimpleConstraints();
      
      setLocalStream(stream);
      addDebugInfo(`✅ Media stream obtained: ${stream.getTracks().length} tracks`);
      setInitializationStep('Media stream obtained');
      
      setInitializationStep('Setting up local video...');
      await setupLocalVideo(stream);
      
      setInitializationStep('Connecting to signaling server...');
      await connectToSignalingServer();
      
      setInitializationStep('Initializing peer connection...');
      initializePeerConnection(stream);
      
      setCameraStatus('active');
      setInitializationStep('WebRTC ready');
      
    } catch (err: any) {
      console.error('Error initializing WebRTC:', err);
      addDebugInfo(`❌ Initialization failed: ${err.message}`);
      setCameraStatus('error');
      setConnectionStatus('disconnected');
      setInitializationStep(`Error: ${err.message}`);
      
      let errorMessage = 'Failed to access camera/microphone. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Camera/microphone access was denied. Please allow permissions and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found. Please connect a camera and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera is being used by another application. Please close other apps and try again.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied. Please try with a different camera.';
      } else if (err.message.includes('Secure context')) {
        errorMessage += 'HTTPS is required for camera access. Please use a secure connection.';
      } else if (err.message.includes('signaling server')) {
        errorMessage += 'Unable to connect to video call servers. Please check your internet connection and try again.';
      } else {
        errorMessage += `Technical error: ${err.message}`;
      }
      
      setError(errorMessage);
    }
  };

  // 🔧 SOLUCIÓN 2: Limpiar streams previos correctamente
  const cleanupPreviousStreams = async () => {
    addDebugInfo('🧹 Cleaning up previous streams...');
    
    // Detener tracks del stream local actual
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        addDebugInfo(`🛑 Stopped previous ${track.kind} track`);
      });
      setLocalStream(null);
    }
    
    // Limpiar elementos de video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Esperar un momento para que se liberen los recursos
    await new Promise(resolve => setTimeout(resolve, 500));
    addDebugInfo('✅ Previous streams cleaned up');
  };

  // 🔧 SOLUCIÓN 3: Constraints simples y compatibles
  const getUserMediaWithSimpleConstraints = async (): Promise<MediaStream> => {
    const constraints = [
      // Constraint básico y compatible
      {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      },
      // Constraint mínimo
      {
        video: true,
        audio: true
      },
      // Solo video si audio falla
      {
        video: true,
        audio: false
      }
    ];

    for (let i = 0; i < constraints.length; i++) {
      try {
        addDebugInfo(`🎯 Trying constraint ${i + 1}/${constraints.length}`);
        const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
        
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        addDebugInfo(`✅ Success! Video: ${videoTracks.length}, Audio: ${audioTracks.length}`);
        
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          addDebugInfo(`📹 Video: ${settings.width}x${settings.height}`);
        }
        
        return stream;
      } catch (err: any) {
        addDebugInfo(`❌ Constraint ${i + 1} failed: ${err.name}`);
        if (i === constraints.length - 1) {
          throw err;
        }
      }
    }
    
    throw new Error('Failed to get media stream');
  };

  const setupLocalVideo = async (stream: MediaStream): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!localVideoRef.current) {
        reject(new Error('Local video ref not available'));
        return;
      }

      const video = localVideoRef.current;
      addDebugInfo('📺 Setting up local video...');
      
      const onLoadedMetadata = () => {
        addDebugInfo(`✅ Local video loaded: ${video.videoWidth}x${video.videoHeight}`);
        video.play().then(() => {
          addDebugInfo('✅ Local video playing');
          resolve();
        }).catch((err) => {
          addDebugInfo(`⚠️ Video play error: ${err.message}`);
          resolve(); // Continue even if play fails
        });
      };

      const onError = (err: any) => {
        addDebugInfo(`❌ Local video error: ${err}`);
        reject(new Error('Local video setup failed'));
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      video.addEventListener('error', onError, { once: true });

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      // Timeout fallback
      setTimeout(() => {
        if (video.readyState === 0) {
          addDebugInfo('⚠️ Video setup timeout, continuing anyway');
          resolve();
        }
      }, 5000);
    });
  };

  const connectToSignalingServer = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const serverUrl = getSignalingServerUrl();
      let connectionEstablished = false;
      
      addDebugInfo(`🛰️ Connecting to: ${serverUrl}`);
      
      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current);
      }
      
      connectionTimeout.current = setTimeout(() => {
        if (!connectionEstablished) {
          addDebugInfo(`⏰ Connection timeout (30s)`);
          reject(new Error('Connection timeout to signaling server'));
        }
      }, 30000);
      
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        secure: serverUrl.startsWith('wss://'),
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        forceNew: true,
        timeout: 20000
      });
      
      socketRef.current = socket;
      
      socket.on('connect', () => {
        if (!connectionEstablished) {
          connectionEstablished = true;
          if (connectionTimeout.current) {
            clearTimeout(connectionTimeout.current);
          }
          addDebugInfo(`✅ Connected to signaling server`);
          setConnectionStatus('connected');
          resolve();
          
          if (!hasJoinedRoom.current) {
            addDebugInfo('🚪 Joining room...');
            socket.emit('join-room', { roomId, userName });
            hasJoinedRoom.current = true;
          }
        }
      });

      socket.on('user-joined', (data) => {
        addDebugInfo(`👤 User joined: ${JSON.stringify(data)}`);
        setParticipants(data.participants);
        if (data.shouldCreateOffer && data.userId !== socket.id) {
          createOffer();
        }
      });

      socket.on('user-left', (data) => {
        addDebugInfo(`👋 User left: ${JSON.stringify(data)}`);
        setParticipants(data.participants);
        setRemoteStream(null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      socket.on('offer', async (data) => {
        if (data.from !== socket.id) {
          await handleOffer(data.offer);
        }
      });

      socket.on('answer', async (data) => {
        if (data.from !== socket.id) {
          await handleAnswer(data.answer);
        }
      });

      socket.on('ice-candidate', async (data) => {
        if (data.from !== socket.id) {
          await handleIceCandidate(data.candidate);
        }
      });

      socket.on('connect_error', (error) => {
        if (!connectionEstablished) {
          addDebugInfo(`❌ Connection error: ${error.message}`);
          reject(new Error(`Failed to connect: ${error.message}`));
        }
      });

      socket.on('disconnect', (reason) => {
        addDebugInfo(`🔌 Disconnected: ${reason}`);
        setConnectionStatus('disconnected');
        hasJoinedRoom.current = false;
      });
    });
  };

  const initializePeerConnection = (stream: MediaStream) => {
    addDebugInfo('🔗 Initializing peer connection...');
    
    const peerConnection = new RTCPeerConnection({
      iceServers: [
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
      ]
    });
    
    peerConnectionRef.current = peerConnection;
    
    stream.getTracks().forEach(track => {
      addDebugInfo(`➕ Adding ${track.kind} track`);
      peerConnection.addTrack(track, stream);
    });

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      addDebugInfo(`📺 Received remote stream`);
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          roomId
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      addDebugInfo(`🔗 Peer connection: ${state}`);
      
      if (state === 'disconnected' || state === 'failed') {
        setRemoteStream(null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    };
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) return;
    
    try {
      addDebugInfo('📤 Creating offer...');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      socketRef.current.emit('offer', { offer, roomId });
      addDebugInfo('✅ Offer sent');
    } catch (err: any) {
      addDebugInfo(`❌ Error creating offer: ${err.message}`);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) return;
    
    try {
      addDebugInfo('📥 Handling offer...');
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      socketRef.current.emit('answer', { answer, roomId });
      addDebugInfo('✅ Answer sent');
    } catch (err: any) {
      addDebugInfo(`❌ Error handling offer: ${err.message}`);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;
    
    try {
      if (peerConnectionRef.current.signalingState === 'stable') {
        addDebugInfo('⚠️ Ignoring duplicate answer');
        return;
      }
      
      addDebugInfo('📨 Handling answer...');
      await peerConnectionRef.current.setRemoteDescription(answer);
      addDebugInfo('✅ Answer handled');
    } catch (err: any) {
      addDebugInfo(`❌ Error handling answer: ${err.message}`);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;
    
    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
      addDebugInfo('✅ ICE candidate added');
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

  const retryConnection = async () => {
    try {
      setError(null);
      setConnectionStatus('connecting');
      setCameraStatus('loading');
      setInitializationStep('Retrying...');
      
      await cleanupPreviousStreams();
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      hasJoinedRoom.current = false;
      initializationAttempts.current = 0;
      
      await initializeWebRTC();
      
    } catch (err: any) {
      addDebugInfo(`❌ Retry failed: ${err.message}`);
      setError('Retry failed. Please refresh the page and try again.');
      setCameraStatus('error');
      setConnectionStatus('disconnected');
    }
  };

  const cleanup = () => {
    addDebugInfo('🧹 Cleaning up...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    if (initializationTimeout.current) {
      clearTimeout(initializationTimeout.current);
    }
    
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
    }
  };

  const handleEndCall = () => {
    cleanup();
    onEndCall();
  };

  useEffect(() => {
    return cleanup;
  }, []);

  // 🔧 SOLUCIÓN 4: Pantalla de inicio que requiere interacción del usuario
  if (!hasUserInteracted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <Video className="h-16 w-16 text-blue-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Ready to Join Call</h2>
          <p className="text-gray-300 mb-6">
            Click the button below to start your camera and join the video call.
          </p>
          <button
            onClick={handleStartCall}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg inline-flex items-center text-lg font-medium transition-colors"
          >
            <Play className="h-6 w-6 mr-2" />
            Start Video Call
          </button>
          <div className="mt-6 text-sm text-gray-400">
            <p>Room: {roomId}</p>
            <p>User: {userName}</p>
          </div>
        </div>
      </div>
    );
  }

  // 🔧 SOLUCIÓN 5: Pantalla de error mejorada
  if (error && (cameraStatus === 'error' || connectionStatus === 'disconnected')) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-4xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
          <p className="text-gray-300 mb-6">{error}</p>
          
          <div className="space-x-4 mb-6">
            <button
              onClick={retryConnection}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
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
              {showDebug ? 'Hide' : 'Show'} Debug
            </button>
          </div>
          
          {showDebug && (
            <div className="bg-gray-800 p-4 rounded-lg text-left text-xs max-h-64 overflow-y-auto mb-4">
              <h4 className="text-white font-semibold mb-2">Debug Information:</h4>
              <pre className="text-gray-300 whitespace-pre-wrap">{debugInfo}</pre>
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-400">
            <p className="font-semibold mb-2">Troubleshooting:</p>
            <ul className="list-disc list-inside text-left space-y-1">
              <li>Ensure you're using HTTPS (required for camera access)</li>
              <li>Allow camera and microphone permissions</li>
              <li>Close other apps using the camera</li>
              <li>Try a different browser (Chrome recommended)</li>
              <li>Check your internet connection</li>
              <li>Verify Render server is accessible</li>
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
            {connectionStatus === 'connected' && <span>🔗 Connected</span>}
            {connectionStatus === 'connecting' && <span>🔄 Connecting...</span>}
            {connectionStatus === 'disconnected' && <span>❌ Disconnected</span>}
            {connectionStatus === 'waiting' && <span>⏳ Waiting</span>}
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
        <div className="absolute top-16 left-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="bg-gray-800 bg-opacity-75 px-2 py-1 rounded text-white text-xs hover:bg-opacity-100"
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>

        {/* Debug Info Panel */}
        {showDebug && (
          <div className="absolute top-24 left-4 bg-gray-900 bg-opacity-95 p-3 rounded-lg max-w-md max-h-64 overflow-y-auto">
            <h4 className="text-white font-semibold mb-2 text-sm">Debug Information:</h4>
            <pre className="text-gray-300 text-xs whitespace-pre-wrap">{debugInfo}</pre>
          </div>
        )}

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
            onClick={retryConnection}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
            title="Retry connection"
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