import React, { useEffect, useRef, useState } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw } from 'lucide-react';
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
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRoom = useRef(false);

  useEffect(() => {
    initializeWebRTC();
    return () => {
      cleanup();
    };
  }, [roomId]);

  const initializeWebRTC = async () => {
    try {
      setCameraStatus('loading');
      
      // Request permissions explicitly first
      await requestMediaPermissions();
      
      // Get user media with fallback options
      const stream = await getUserMediaWithFallback();
      
      setLocalStream(stream);
      setCameraStatus('active');
      
      // Set up local video with error handling
      await setupLocalVideo(stream);

      // Connect to signaling server
      connectToSignalingServer();
      
      // Initialize peer connection
      initializePeerConnection(stream);
      
    } catch (err) {
      console.error('Error initializing WebRTC:', err);
      setCameraStatus('error');
      setError('Failed to access camera/microphone. Please check permissions and try again.');
    }
  };

  const requestMediaPermissions = async () => {
    try {
      // Request permissions explicitly
      const permissions = await Promise.all([
        navigator.permissions.query({ name: 'camera' as PermissionName }),
        navigator.permissions.query({ name: 'microphone' as PermissionName })
      ]);
      
      console.log('Camera permission:', permissions[0].state);
      console.log('Microphone permission:', permissions[1].state);
      
      if (permissions[0].state === 'denied' || permissions[1].state === 'denied') {
        throw new Error('Camera or microphone permissions denied');
      }
    } catch (err) {
      console.warn('Permission query not supported, proceeding with getUserMedia');
    }
  };

  const getUserMediaWithFallback = async (): Promise<MediaStream> => {
    const constraints = [
      // Try high quality first
      {
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true
        }
      },
      // Fallback to medium quality
      {
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
          facingMode: 'user'
        },
        audio: true
      },
      // Fallback to basic constraints
      {
        video: true,
        audio: true
      },
      // Last resort - video only
      {
        video: true,
        audio: false
      }
    ];

    for (let i = 0; i < constraints.length; i++) {
      try {
        console.log(`Trying media constraints ${i + 1}/${constraints.length}:`, constraints[i]);
        const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
        console.log('✅ Successfully got media stream with constraints:', constraints[i]);
        return stream;
      } catch (err) {
        console.warn(`❌ Failed with constraints ${i + 1}:`, err);
        if (i === constraints.length - 1) {
          throw err;
        }
      }
    }
    
    throw new Error('Failed to get media stream with any constraints');
  };

  const setupLocalVideo = async (stream: MediaStream): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!localVideoRef.current) {
        reject(new Error('Local video ref not available'));
        return;
      }

      const video = localVideoRef.current;
      
      // Set up event handlers
      video.onloadedmetadata = () => {
        console.log('✅ Local video metadata loaded');
        video.play().then(() => {
          console.log('✅ Local video playing');
          resolve();
        }).catch((err) => {
          console.error('❌ Error playing local video:', err);
          reject(err);
        });
      };

      video.onerror = (err) => {
        console.error('❌ Local video error:', err);
        reject(new Error('Local video error'));
      };

      // Set video properties
      video.srcObject = stream;
      video.muted = true; // Always mute local video to prevent feedback
      video.playsInline = true;
      video.autoplay = true;

      // Timeout fallback
      setTimeout(() => {
        if (video.readyState === 0) {
          console.warn('⚠️ Video not loaded after timeout, forcing play');
          video.play().catch(console.error);
          resolve();
        }
      }, 3000);
    });
  };

  const connectToSignalingServer = () => {
    // Get the correct signaling server URL
    const signalingUrl = window.location.hostname === 'localhost' 
      ? 'ws://localhost:3000'
      : 'wss://biometricov4.onrender.com';
    
    console.log('🛰️ Connecting to signaling server:', signalingUrl);
    
    const socket = io(signalingUrl, {
      transports: ['websocket'],
      secure: window.location.protocol === 'https:',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true,
      timeout: 10000
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ Connected to signaling server with socket ID:', socket.id);
      setConnectionStatus('connected');
      
      if (!hasJoinedRoom.current) {
        console.log('🚪 Joining room for the first time...');
        socket.emit('join-room', { roomId, userName });
        hasJoinedRoom.current = true;
      }
    });

    socket.on('user-joined', (data) => {
      console.log('👤 User joined event received:', data);
      setParticipants(data.participants);
      if (data.shouldCreateOffer && data.userId !== socket.id) {
        console.log('📤 Creating offer for new participant');
        createOffer();
      }
    });

    socket.on('user-left', (data) => {
      console.log('👋 User left event received:', data);
      setParticipants(data.participants);
      setRemoteStream(null);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    socket.on('offer', async (data) => {
      console.log('📥 Received offer from:', data.from);
      if (data.from !== socket.id) {
        await handleOffer(data.offer);
      }
    });

    socket.on('answer', async (data) => {
      console.log('📨 Received answer from:', data.from);
      if (data.from !== socket.id) {
        await handleAnswer(data.answer);
      }
    });

    socket.on('ice-candidate', async (data) => {
      console.log('🧊 Received ICE candidate from:', data.from);
      if (data.from !== socket.id) {
        await handleIceCandidate(data.candidate);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setError('Failed to connect to signaling server');
      setConnectionStatus('disconnected');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from signaling server:', reason);
      setConnectionStatus('disconnected');
      hasJoinedRoom.current = false;
    });

    socket.on('reconnect', () => {
      console.log('🔄 Reconnected to signaling server');
      setConnectionStatus('connected');
      hasJoinedRoom.current = false;
    });
  };

  const initializePeerConnection = (stream: MediaStream) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        },
        {
          urls: 'stun:stun1.l.google.com:19302'
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
        }
      ]
    });
    
    peerConnectionRef.current = peerConnection;
    
    // Add local stream tracks
    stream.getTracks().forEach(track => {
      console.log('➕ Adding track to peer connection:', track.kind);
      peerConnection.addTrack(track, stream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      console.log('📺 Received remote stream');
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.connected) {
        console.log('🧊 Sending ICE candidate');
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          roomId
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('🔗 Peer connection state:', state);
      
      if (state === 'connected') {
        console.log('✅ Peer connection established successfully');
      } else if (state === 'disconnected' || state === 'failed') {
        console.log('❌ Peer connection lost');
        setRemoteStream(null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log('🔍 ICE gathering state:', peerConnection.iceGatheringState);
    };
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) {
      console.log('⚠️ Cannot create offer: peer connection or socket not ready');
      return;
    }
    
    try {
      console.log('📤 Creating offer...');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      socketRef.current.emit('offer', {
        offer,
        roomId
      });
      console.log('✅ Offer sent successfully');
    } catch (err) {
      console.error('❌ Error creating offer:', err);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current || !socketRef.current?.connected) {
      console.log('⚠️ Cannot handle offer: peer connection or socket not ready');
      return;
    }
    
    try {
      console.log('📥 Handling received offer...');
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      socketRef.current.emit('answer', {
        answer,
        roomId
      });
      console.log('✅ Answer sent successfully');
    } catch (err) {
      console.error('❌ Error handling offer:', err);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.log('⚠️ Cannot handle answer: peer connection not ready');
      return;
    }
    
    try {
      if (peerConnectionRef.current.signalingState === 'stable') {
        console.log('⚠️ Peer connection already stable, ignoring duplicate answer');
        return;
      }
      
      console.log('📨 Handling received answer...');
      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log('✅ Answer handled successfully');
    } catch (err) {
      console.error('❌ Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      console.log('⚠️ Cannot handle ICE candidate: peer connection not ready');
      return;
    }
    
    try {
      console.log('🧊 Adding ICE candidate...');
      await peerConnectionRef.current.addIceCandidate(candidate);
      console.log('✅ ICE candidate added successfully');
    } catch (err) {
      console.error('❌ Error handling ICE candidate:', err);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const retryCamera = async () => {
    try {
      setCameraStatus('loading');
      setError(null);
      
      // Stop existing stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Try to get new stream
      const stream = await getUserMediaWithFallback();
      setLocalStream(stream);
      await setupLocalVideo(stream);
      setCameraStatus('active');
      
      // Update peer connection if it exists
      if (peerConnectionRef.current) {
        // Remove old tracks
        const senders = peerConnectionRef.current.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            peerConnectionRef.current?.removeTrack(sender);
          }
        });
        
        // Add new tracks
        stream.getTracks().forEach(track => {
          peerConnectionRef.current?.addTrack(track, stream);
        });
      }
      
    } catch (err) {
      console.error('Error retrying camera:', err);
      setCameraStatus('error');
      setError('Failed to restart camera. Please refresh the page.');
    }
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up WebRTC resources...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
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
        <div className="text-center p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Camera Access Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <div className="space-x-4">
            <button
              onClick={retryCamera}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Camera
            </button>
            <button
              onClick={handleEndCall}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
            >
              Return to Dashboard
            </button>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            <p>Make sure to:</p>
            <ul className="list-disc list-inside mt-2">
              <li>Allow camera and microphone permissions</li>
              <li>Close other apps using the camera</li>
              <li>Use HTTPS (required for camera access)</li>
              <li>Try refreshing the page</li>
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
          
          {/* Camera status indicator */}
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
            {connectionStatus === 'connected' && <span>🔗 Connected via Render</span>}
            {connectionStatus === 'connecting' && <span>🔄 Connecting to Render...</span>}
            {connectionStatus === 'disconnected' && <span>❌ Disconnected</span>}
          </div>
        </div>

        {/* Participants Count */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-full text-white text-sm flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Server Info */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-full text-white text-xs">
            🛰️ Render + 🌐 Google STUN + 🔁 OpenRelay TURN + 🔒 Vercel HTTPS
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

        {cameraStatus === 'error' && (
          <button
            onClick={retryCamera}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
            title="Retry camera"
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