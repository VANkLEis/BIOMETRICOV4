import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Activity, Wifi, Shield, Camera, Fingerprint, Scan, Eye, TestTube, Wrench } from 'lucide-react';
import { initializeEnhancedVideoCall, getEnhancedDebugInfo, toggleEnhancedVideo, toggleEnhancedAudio, cleanupEnhancedVideoCall } from '../utils/enhancedVideoCallManager.js';

interface EnhancedWebRTCRoomProps {
  userName: string;
  roomId: string;
  onEndCall: () => void;
}

const EnhancedWebRTCRoom: React.FC<EnhancedWebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const enhancedManagerRef = useRef<any>(null);
  
  // Estados principales
  const [connectionState, setConnectionState] = useState<string>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<any>(null);
  
  // Estados de UI
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Estados de timing y diagnóstico
  const [joinStartTime, setJoinStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isGuest, setIsGuest] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  
  // Estados de animación
  const [faceScanning, setFaceScanning] = useState(false);
  const [fingerprintScanning, setFingerprintScanning] = useState(false);

  // Actualizar tiempo transcurrido
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (joinStartTime && !['ready', 'peer_connected', 'error'].includes(connectionState)) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - joinStartTime);
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [joinStartTime, connectionState]);

  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  const getStateMessage = () => {
    switch (connectionState) {
      case 'idle':
        return 'Initializing...';
      case 'connecting_signaling':
        return `Connecting to server... (${formatElapsedTime(elapsedTime)})`;
      case 'signaling_connected':
        return 'Connected to server';
      case 'joining_room':
        return `Joining room... (${formatElapsedTime(elapsedTime)})`;
      case 'room_joined':
        return 'Room joined successfully';
      case 'requesting_media':
        return `Requesting camera permissions... (${formatElapsedTime(elapsedTime)})`;
      case 'media_ready':
        return 'Camera ready - waiting for participants';
      case 'creating_peer_connection':
        return 'Establishing connection...';
      case 'peer_connected':
        return 'Call active - Enhanced WebRTC';
      case 'ready':
        return 'Ready for call';
      case 'error':
        return 'Connection error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return connectionState;
    }
  };

  const getStateColor = () => {
    switch (connectionState) {
      case 'peer_connected':
      case 'ready':
        return 'bg-green-600';
      case 'connecting_signaling':
      case 'joining_room':
      case 'requesting_media':
      case 'creating_peer_connection':
        return 'bg-yellow-600';
      case 'error':
        return 'bg-red-600';
      case 'disconnected':
        return 'bg-gray-600';
      default:
        return 'bg-blue-600';
    }
  };

  // Callback para manejar stream local
  const handleLocalStream = useCallback((stream: MediaStream) => {
    console.log("🎥 ENHANCED: Local stream received:", stream);
    setLocalStream(stream);
    
    if (localVideoRef.current) {
      console.log("🎥 ENHANCED: Assigning local stream to video element");
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      
      localVideoRef.current.play().then(() => {
        console.log("✅ ENHANCED: Local video is now playing");
      }).catch(error => {
        console.error("❌ ENHANCED: Local video play failed:", error);
      });
    }
  }, []);

  // Callback para manejar stream remoto
  const handleRemoteStream = useCallback((stream: MediaStream | null) => {
    console.log("🖼️ ENHANCED: Remote stream received:", stream);
    setRemoteStream(stream);
    
    if (stream && remoteVideoRef.current) {
      console.log("🖼️ ENHANCED: Assigning remote stream to video element");
      remoteVideoRef.current.srcObject = stream;
      
      remoteVideoRef.current.play().then(() => {
        console.log("✅ ENHANCED: Remote video is now playing with audio");
      }).catch(error => {
        console.error("❌ ENHANCED: Remote video play failed:", error);
      });
    } else if (!stream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  // Callback para cambios de estado
  const handleStateChange = useCallback((newState: string, oldState: string, data: any) => {
    console.log(`🔄 ENHANCED: State change: ${oldState} → ${newState}`, data);
    setConnectionState(newState);
    
    if (data && data.diagnostics) {
      setDiagnostics(data.diagnostics);
    }
  }, []);

  // Callback para cambios de participantes
  const handleParticipantsChange = useCallback((newParticipants: string[]) => {
    console.log("👥 ENHANCED: Participants changed:", newParticipants);
    setParticipants(newParticipants);
  }, []);

  // Callback para errores
  const handleError = useCallback((errorInfo: any) => {
    console.error("❌ ENHANCED: Error received:", errorInfo);
    setError(errorInfo);
    setConnectionState('error');
  }, []);

  // Inicialización automática
  useEffect(() => {
    const initializeCall = async () => {
      try {
        setConnectionState('idle');
        setJoinStartTime(Date.now());
        setError(null);

        console.log('🚀 ENHANCED: Initializing Enhanced VideoCallManager...');
        
        // Determinar rol (simplificado para testing)
        const isHost = Math.random() > 0.5;
        setIsGuest(!isHost);
        
        console.log(`🎭 ENHANCED: Role determined - ${isHost ? 'HOST' : 'GUEST'}`);
        
        // Configurar callbacks
        const callbacks = {
          onLocalStream: handleLocalStream,
          onRemoteStream: handleRemoteStream,
          onStateChange: handleStateChange,
          onParticipantsChange: handleParticipantsChange,
          onError: handleError
        };
        
        // Inicializar Enhanced VideoCallManager
        const manager = await initializeEnhancedVideoCall(roomId, userName, isHost, callbacks);
        enhancedManagerRef.current = manager;
        
        console.log('✅ ENHANCED: Enhanced VideoCallManager initialized');
        
        // Actualizar debug info periódicamente
        const debugInterval = setInterval(() => {
          const debug = getEnhancedDebugInfo();
          setDebugInfo(debug);
          setDiagnostics(debug.diagnostics);
        }, 2000);
        
        return () => clearInterval(debugInterval);
        
      } catch (err: any) {
        console.error('❌ ENHANCED: Failed to initialize Enhanced VideoCallManager:', err);
        
        let errorMessage = err.message;
        let suggestions = err.suggestions || [];
        
        if (err.context === 'server_connection') {
          suggestions = [
            'Check your internet connection',
            'The server may be starting up - wait 30 seconds and try again',
            'Try refreshing the page'
          ];
        } else if (err.context === 'media_access') {
          suggestions = [
            'Click "Allow" when prompted for camera/microphone access',
            'Check camera permissions in browser settings',
            'Close other apps using the camera (Zoom, Teams, etc.)',
            'Try using a different browser (Chrome recommended)'
          ];
        }
        
        setError({
          message: errorMessage,
          suggestions: suggestions,
          context: err.context,
          isGuest: err.isGuest,
          diagnostics: err.diagnostics,
          originalError: err
        });
        setConnectionState('error');
      }
    };

    initializeCall();
    
    return () => {
      if (enhancedManagerRef.current) {
        cleanupEnhancedVideoCall();
        enhancedManagerRef.current = null;
      }
    };
  }, [roomId, userName, handleLocalStream, handleRemoteStream, handleStateChange, handleParticipantsChange, handleError]);

  // Animaciones de escaneo
  const handleFaceScan = () => {
    if (faceScanning) return;
    setFaceScanning(true);
    setTimeout(() => setFaceScanning(false), 3000);
  };

  const handleFingerprintScan = () => {
    if (fingerprintScanning) return;
    setFingerprintScanning(true);
    setTimeout(() => setFingerprintScanning(false), 3000);
  };

  // Toggle controles
  const handleToggleVideo = () => {
    const enabled = toggleEnhancedVideo();
    setIsVideoEnabled(enabled);
  };

  const handleToggleAudio = () => {
    const enabled = toggleEnhancedAudio();
    setIsAudioEnabled(enabled);
  };

  // Reintentar conexión
  const handleRetry = async () => {
    setError(null);
    setConnectionState('idle');
    
    if (enhancedManagerRef.current) {
      cleanupEnhancedVideoCall();
      enhancedManagerRef.current = null;
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Finalizar llamada
  const handleEndCall = () => {
    if (enhancedManagerRef.current) {
      cleanupEnhancedVideoCall();
      enhancedManagerRef.current = null;
    }
    onEndCall();
  };

  // Obtener debug info
  const handleGetDebugInfo = () => {
    const debug = getEnhancedDebugInfo();
    setDebugInfo(debug);
    console.log('📊 ENHANCED: Debug Info:', debug);
  };

  // Pantalla de conexión
  if (['idle', 'connecting_signaling', 'signaling_connected', 'joining_room'].includes(connectionState)) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <div className="relative mb-6">
            <Wifi className="h-16 w-16 text-blue-500 mx-auto animate-pulse" />
            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
              {formatElapsedTime(elapsedTime)}
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-4">
            {connectionState === 'idle' ? 'Initializing Enhanced WebRTC...' : 'Connecting to Room'}
          </h2>
          
          <p className="text-gray-300 mb-6">
            Setting up secure video call with enhanced connectivity...
            {isGuest && <span className="block text-yellow-300 mt-2">Joining as Guest</span>}
          </p>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>Room: {roomId}</p>
            <p>User: {userName}</p>
            <p>Role: {isGuest ? 'Guest' : 'Host'}</p>
            <p>Time: {formatElapsedTime(elapsedTime)}</p>
            <p>State: {getStateMessage()}</p>
          </div>

          {diagnostics && (
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <p>🌐 Server: {diagnostics.serverReachable ? '✅' : '❌'}</p>
              <p>🔌 Socket: {diagnostics.socketConnected ? '✅' : '❌'}</p>
              <p>🚪 Room: {diagnostics.roomJoined ? '✅' : '❌'}</p>
              <p>🎥 Media: {diagnostics.mediaGranted ? '✅' : '❌'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pantalla de solicitud de medios
  if (connectionState === 'requesting_media') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <div className="relative mb-6">
            <Camera className="h-16 w-16 text-yellow-500 mx-auto animate-pulse" />
            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
              {formatElapsedTime(elapsedTime)}
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Camera Permission Required</h2>
          
          <p className="text-gray-300 mb-6">
            Please allow access to your camera and microphone when prompted by your browser.
          </p>
          
          <div className="bg-yellow-900 bg-opacity-30 p-4 rounded-lg mb-6">
            <Shield className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-200 text-sm">
              Waiting for permissions... ({formatElapsedTime(elapsedTime)})
            </p>
            <p className="text-yellow-300 text-xs mt-2">
              Look for the permission popup in your browser
            </p>
          </div>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>🔗 Connection: Active</p>
            <p>👥 Participants: {participants.length}</p>
            <p>⏱️ Timeout: 45 seconds</p>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de error mejorada
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-4xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
          <p className="text-gray-300 mb-4">{error.message}</p>
          
          {error.suggestions && error.suggestions.length > 0 && (
            <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg mb-6 text-left">
              <h4 className="text-blue-200 font-semibold mb-2">Suggestions:</h4>
              <ul className="text-blue-200 text-sm space-y-1">
                {error.suggestions.map((suggestion: string, index: number) => (
                  <li key={index}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="space-x-4 mb-6">
            <button
              onClick={handleRetry}
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
          
          {showDebug && debugInfo && (
            <div className="bg-gray-800 p-4 rounded-lg text-left text-xs max-h-64 overflow-y-auto mb-4">
              <h4 className="text-white font-semibold mb-2">Enhanced Debug Information:</h4>
              <pre className="text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}

          {error.diagnostics && (
            <div className="mt-4 text-sm text-gray-400">
              <p className="font-semibold mb-2">Connection Diagnostics:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Server: {error.diagnostics.serverReachable ? '✅ Reachable' : '❌ Unreachable'}</div>
                <div>Socket: {error.diagnostics.socketConnected ? '✅ Connected' : '❌ Disconnected'}</div>
                <div>Room: {error.diagnostics.roomJoined ? '✅ Joined' : '❌ Not Joined'}</div>
                <div>Media: {error.diagnostics.mediaGranted ? '✅ Granted' : '❌ Denied'}</div>
                <div>Peer: {error.diagnostics.peerConnected ? '✅ Connected' : '❌ Failed'}</div>
                <div>ICE: {error.diagnostics.iceConnected ? '✅ Connected' : '❌ Failed'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Interfaz principal de videollamada
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
          onLoadedMetadata={() => console.log("✅ ENHANCED: Remote video metadata loaded")}
          onPlay={() => console.log("✅ ENHANCED: Remote video started playing")}
          onError={(e) => console.error("❌ ENHANCED: Remote video error:", e)}
        />
        
        {/* Animaciones de escaneo */}
        {faceScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full">
              <div 
                className="absolute left-0 right-0 h-1 bg-green-400 shadow-lg"
                style={{
                  animation: 'faceScan 3s ease-in-out',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)'
                }}
              />
              <div className="absolute inset-0 bg-green-400 bg-opacity-10 border-2 border-green-400 border-dashed animate-pulse" />
              <div className="absolute top-4 left-4 bg-green-600 bg-opacity-90 text-white px-3 py-1 rounded-lg text-sm font-medium">
                🔍 Scanning Face...
              </div>
            </div>
          </div>
        )}
        
        {fingerprintScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full">
              <div 
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-blue-400 rounded-full"
                style={{
                  animation: 'fingerprintScan 3s ease-in-out infinite',
                  boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)'
                }}
              />
              <div className="absolute inset-0 bg-blue-400 bg-opacity-10 animate-pulse" />
              <div className="absolute top-4 left-4 bg-blue-600 bg-opacity-90 text-white px-3 py-1 rounded-lg text-sm font-medium">
                👆 Scanning Fingerprint...
              </div>
            </div>
          </div>
        )}
        
        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-gray-600">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            onLoadedMetadata={() => console.log("✅ ENHANCED: Local video metadata loaded")}
            onPlay={() => console.log("✅ ENHANCED: Local video started playing")}
            onError={(e) => console.error("❌ ENHANCED: Local video error:", e)}
          />
          
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-gray-400" />
            </div>
          )}
          
          {/* Status Indicators */}
          <div className="absolute top-2 left-2">
            <div className={`w-3 h-3 rounded-full ${
              ['peer_connected', 'ready'].includes(connectionState) ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
          </div>
          
          <div className="absolute top-2 right-2">
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              isGuest ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
            }`}>
              {isGuest ? 'Guest' : 'Host'}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="absolute top-4 left-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStateColor()}`}>
            {getStateMessage()}
          </div>
        </div>

        {/* Participants Count */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-full text-white text-sm flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {participants.length || 1} participant{(participants.length || 1) !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Debug Toggle */}
        <div className="absolute top-16 left-4">
          <button
            onClick={() => {
              setShowDebug(!showDebug);
              if (!showDebug) handleGetDebugInfo();
            }}
            className="bg-gray-800 bg-opacity-75 px-2 py-1 rounded text-white text-xs hover:bg-opacity-100"
          >
            {showDebug ? 'Hide' : 'Show'} Enhanced Debug
          </button>
        </div>

        {/* Enhanced Debug Info Panel */}
        {showDebug && debugInfo && (
          <div className="absolute top-24 left-4 bg-gray-900 bg-opacity-95 p-3 rounded-lg max-w-md max-h-64 overflow-y-auto">
            <h4 className="text-white font-semibold mb-2 text-sm">Enhanced Debug Information:</h4>
            <div className="text-gray-300 text-xs space-y-1">
              <p>State: {connectionState}</p>
              <p>Role: {isGuest ? 'Guest' : 'Host'}</p>
              <p>Attempts: {debugInfo.connectionAttempts}</p>
              <p>Local Stream: {debugInfo.hasLocalStream ? '✅' : '❌'}</p>
              <p>Remote Stream: {debugInfo.hasRemoteStream ? '✅' : '❌'}</p>
              <p>Socket: {debugInfo.isSocketConnected ? '✅' : '❌'}</p>
              <p>Peer State: {debugInfo.peerConnectionState || 'none'}</p>
              <p>ICE State: {debugInfo.iceConnectionState || 'none'}</p>
              {debugInfo.diagnostics && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <p className="font-semibold">Diagnostics:</p>
                  <p>Server: {debugInfo.diagnostics.serverReachable ? '✅' : '❌'}</p>
                  <p>Socket: {debugInfo.diagnostics.socketConnected ? '✅' : '❌'}</p>
                  <p>Room: {debugInfo.diagnostics.roomJoined ? '✅' : '❌'}</p>
                  <p>Media: {debugInfo.diagnostics.mediaGranted ? '✅' : '❌'}</p>
                  <p>Peer: {debugInfo.diagnostics.peerConnected ? '✅' : '❌'}</p>
                  <p>ICE: {debugInfo.diagnostics.iceConnected ? '✅' : '❌'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Remote Stream Message */}
        {['media_ready', 'ready'].includes(connectionState) && !remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
            <div className="text-center text-white">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-xl">Waiting for other participants...</p>
              <p className="text-sm text-gray-400 mt-2">Share the room code to invite others</p>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Controls */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-center space-x-4">
        <button
          onClick={handleToggleAudio}
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
          onClick={handleToggleVideo}
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

        {/* Botones de animación de escaneo */}
        <button
          onClick={handleFaceScan}
          disabled={faceScanning}
          className={`p-3 rounded-full transition-colors ${
            faceScanning ? 'bg-green-600 animate-pulse' : 'bg-green-600 hover:bg-green-700'
          } disabled:opacity-50`}
          title="Face scan animation"
        >
          <Scan className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleFingerprintScan}
          disabled={fingerprintScanning}
          className={`p-3 rounded-full transition-colors ${
            fingerprintScanning ? 'bg-blue-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-50`}
          title="Fingerprint scan animation"
        >
          <Fingerprint className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleGetDebugInfo}
          className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
          title="Get enhanced debug info"
        >
          <Eye className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleEndCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="End call"
        >
          <Phone className="h-6 w-6 text-white transform rotate-135" />
        </button>
      </div>

      {/* CSS para animaciones */}
      <style jsx>{`
        @keyframes faceScan {
          0% { top: 0; opacity: 1; }
          50% { top: 50%; opacity: 0.8; }
          100% { top: 100%; opacity: 0; }
        }
        
        @keyframes fingerprintScan {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default EnhancedWebRTCRoom;