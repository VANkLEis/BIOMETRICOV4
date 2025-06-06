import React, { useEffect, useRef, useState } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle } from 'lucide-react';
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
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connect to signaling server
      connectToSignalingServer();
      
      // Initialize peer connection
      initializePeerConnection(stream);
      
    } catch (err) {
      console.error('Error initializing WebRTC:', err);
      setError('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const connectToSignalingServer = () => {
    // 🛰️ AJUSTE 2: Usar wss:// en el cliente para la conexión WebSocket en producción
    const socket = io('wss://biometricov4.onrender.com', {
      transports: ['websocket'],
      secure: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true // Forzar nueva conexión para evitar reutilización de sockets
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ Connected to Render signaling server with socket ID:', socket.id);
      setConnectionStatus('connected');
      
      // 🔒 AJUSTE 3: Agregar control para evitar reconexiones automáticas múltiples
      if (!hasJoinedRoom.current) {
        console.log('🚪 Joining room for the first time...');
        socket.emit('join-room', { roomId, userName });
        hasJoinedRoom.current = true;
      } else {
        console.log('⚠️ Already joined room, skipping duplicate join');
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
      hasJoinedRoom.current = false; // Reset join flag on disconnect
    });

    socket.on('reconnect', () => {
      console.log('🔄 Reconnected to signaling server');
      setConnectionStatus('connected');
      hasJoinedRoom.current = false; // Reset flag to allow rejoin
    });
  };

  const initializePeerConnection = (stream: MediaStream) => {
    // 🌐 STUN de Google + 🔁 TURN gratuito de OpenRelay
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302' // STUN gratuito de Google
        },
        {
          urls: 'turn:openrelay.metered.ca:80',  // TURN gratuito
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443', // TURN gratuito HTTPS
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });
    
    peerConnectionRef.current = peerConnection;
    
    // Add local stream tracks
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      console.log('📺 Received remote stream');
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
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

    // Log ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
    };

    // Log ICE gathering state changes
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
      // Check if the peer connection is in the correct state to receive an answer
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={handleEndCall}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
          >
            Return to Dashboard
          </button>
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
        <div className="absolute top-4 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-gray-400" />
            </div>
          )}
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
            🛰️ Render + 🌐 Google STUN + 🔁 OpenRelay TURN + 🔒 Anti-Duplicate
          </div>
        </div>

        {/* No Remote Stream Message */}
        {!remoteStream && connectionStatus === 'connected' && (
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