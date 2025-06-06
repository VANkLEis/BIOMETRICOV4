import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Play, Clock, Wifi } from 'lucide-react';
import CallManager from '../utils/callManager.js';

interface WebRTCRoomProps {
  userName: string;
  roomId: string;
  onEndCall: () => void;
}

const WebRTCRoom: React.FC<WebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callManagerRef = useRef<CallManager | null>(null);
  
  // Estados principales
  const [callState, setCallState] = useState<string>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<any>(null);
  
  // Estados de UI
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string>('');
  const [mediaInfo, setMediaInfo] = useState<any>(null);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  
  // Estados de timing
  const [joinStartTime, setJoinStartTime] = useState<number | null>(null);
  const [mediaRequestTime, setMediaRequestTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Actualizar tiempo transcurrido
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (joinStartTime && (callState === 'joining' || callState === 'requesting_media')) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - joinStartTime);
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [joinStartTime, callState]);

  // Formatear tiempo transcurrido
  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  // Obtener mensaje de estado para UI
  const getStateMessage = () => {
    switch (callState) {
      case 'idle':
        return 'Ready to join call';
      case 'joining':
        return `Connecting to room... (${formatElapsedTime(elapsedTime)})`;
      case 'signaling_ready':
        return 'Connected to room - Ready for media';
      case 'requesting_media':
        return `Requesting camera permissions... (${formatElapsedTime(elapsedTime)})`;
      case 'media_ready':
        return 'Media ready - Establishing peer connection...';
      case 'connected':
        return 'Call active';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error occurred';
      default:
        return callState;
    }
  };

  // Obtener color de estado
  const getStateColor = () => {
    switch (callState) {
      case 'connected':
        return 'bg-green-600';
      case 'requesting_media':
      case 'joining':
      case 'media_ready':
        return 'bg-yellow-600';
      case 'signaling_ready':
        return 'bg-blue-600';
      case 'error':
      case 'disconnected':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Inicializar CallManager
  useEffect(() => {
    const callManager = new CallManager();
    callManagerRef.current = callManager;
    
    // Habilitar debug
    callManager.setDebugMode(true);
    
    // Configurar callbacks
    callManager.setCallbacks({
      onStateChange: (newState: string, oldState: string, data: any) => {
        console.log(`🔄 State change: ${oldState} → ${newState}`, data);
        setCallState(newState);
        
        // Actualizar información de conexión
        setConnectionInfo(callManager.getState());
        
        // Manejar estados específicos
        if (newState === 'media_ready' && data?.mediaInfo) {
          setMediaInfo(data.mediaInfo);
        }
      },
      
      onParticipantsChange: (newParticipants: string[]) => {
        console.log('👥 Participants changed:', newParticipants);
        setParticipants(newParticipants);
      },
      
      onRemoteStream: (stream: MediaStream | null) => {
        console.log('📺 Remote stream:', stream ? 'received' : 'cleared');
        setRemoteStream(stream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          if (stream) {
            remoteVideoRef.current.play().catch(console.error);
          }
        }
      },
      
      onError: (errorInfo: any) => {
        console.error('❌ Call error:', errorInfo);
        setError(errorInfo);
      },
      
      onDebug: (logMessage: string) => {
        setDebugLogs(prev => prev + '\n' + logMessage);
      }
    });
    
    return () => {
      callManager.cleanup();
    };
  }, []);

  // 🔧 FASE 1: Unirse al room SIN medios
  const handleJoinRoom = async () => {
    if (!callManagerRef.current) return;
    
    try {
      setError(null);
      setJoinStartTime(Date.now());
      
      console.log('🚀 Starting room join process...');
      
      await callManagerRef.current.joinRoom(roomId, userName, true);
      
      console.log('✅ Room joined successfully');
      
    } catch (err: any) {
      console.error('❌ Failed to join room:', err);
      setError(err);
    }
  };

  // 🔧 FASE 2: Solicitar medios (requiere interacción del usuario)
  const handleRequestMedia = async () => {
    if (!callManagerRef.current) return;
    
    try {
      setError(null);
      setMediaRequestTime(Date.now());
      
      console.log('🎥 Starting media request...');
      
      const result = await callManagerRef.current.requestMedia({
        quality: 'medium',
        video: true,
        audio: true,
        fallbackToAudioOnly: true,
        allowPartialSuccess: true
      });
      
      console.log('✅ Media obtained:', result);
      
      setLocalStream(result.stream);
      setMediaInfo(result.mediaInfo);
      
      // Configurar video local
      if (localVideoRef.current && result.stream) {
        localVideoRef.current.srcObject = result.stream;
        localVideoRef.current.play().catch(console.error);
      }
      
    } catch (err: any) {
      console.error('❌ Failed to get media:', err);
      setError(err);
    }
  };

  // Toggle controles
  const toggleVideo = () => {
    if (callManagerRef.current) {
      const enabled = callManagerRef.current.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  const toggleAudio = () => {
    if (callManagerRef.current) {
      const enabled = callManagerRef.current.toggleAudio();
      setIsAudioEnabled(enabled);
    }
  };

  // Reintentar conexión
  const handleRetry = async () => {
    if (!callManagerRef.current) return;
    
    setError(null);
    
    // Si estamos en signaling_ready, solo reintentar medios
    if (callState === 'signaling_ready') {
      await handleRequestMedia();
    } else {
      // Limpiar y empezar de nuevo
      callManagerRef.current.cleanup();
      await handleJoinRoom();
    }
  };

  // Finalizar llamada
  const handleEndCall = () => {
    if (callManagerRef.current) {
      callManagerRef.current.cleanup();
    }
    onEndCall();
  };

  // Auto-join al montar el componente
  useEffect(() => {
    if (callState === 'idle') {
      handleJoinRoom();
    }
  }, []);

  // 🎨 PANTALLA DE INICIO - Esperando conexión inicial
  if (callState === 'idle' || callState === 'joining') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <div className="relative mb-6">
            <Wifi className="h-16 w-16 text-blue-500 mx-auto animate-pulse" />
            {callState === 'joining' && (
              <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
                {formatElapsedTime(elapsedTime)}
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-bold mb-4">
            {callState === 'idle' ? 'Initializing...' : 'Connecting to Room'}
          </h2>
          
          <p className="text-gray-300 mb-6">
            {callState === 'idle' 
              ? 'Setting up the call system...'
              : 'Establishing secure connection to the signaling server...'
            }
          </p>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>Room: {roomId}</p>
            <p>User: {userName}</p>
            {callState === 'joining' && (
              <p>Time: {formatElapsedTime(elapsedTime)}</p>
            )}
          </div>
          
          {error && (
            <div className="mt-6">
              <button
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 🎨 PANTALLA DE ACTIVACIÓN DE MEDIOS - Requiere interacción del usuario
  if (callState === 'signaling_ready') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <div className="relative mb-6">
            <Video className="h-16 w-16 text-green-500 mx-auto" />
            <div className="absolute -top-2 -right-2 bg-green-500 w-6 h-6 rounded-full flex items-center justify-center">
              <span className="text-xs">✓</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Ready to Start Video</h2>
          
          <p className="text-gray-300 mb-6">
            Successfully connected to the room! Click below to activate your camera and microphone.
          </p>
          
          <button
            onClick={handleRequestMedia}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg inline-flex items-center text-lg font-medium transition-colors mb-6"
          >
            <Play className="h-6 w-6 mr-2" />
            Activate Camera & Microphone
          </button>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>✅ Connected to room: {roomId}</p>
            <p>👥 Participants: {participants.length}</p>
            {participants.length > 1 && (
              <p>Others in room: {participants.filter(p => p !== userName).join(', ')}</p>
            )}
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p>💡 This step requires your permission to access camera and microphone</p>
          </div>
        </div>
      </div>
    );
  }

  // 🎨 PANTALLA DE SOLICITUD DE MEDIOS - Esperando permisos
  if (callState === 'requesting_media') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <div className="relative mb-6">
            <Video className="h-16 w-16 text-yellow-500 mx-auto animate-pulse" />
            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
              {formatElapsedTime(elapsedTime)}
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Requesting Permissions</h2>
          
          <p className="text-gray-300 mb-6">
            Please allow access to your camera and microphone when prompted by your browser.
          </p>
          
          <div className="bg-yellow-900 bg-opacity-30 p-4 rounded-lg mb-6">
            <Clock className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-200 text-sm">
              Waiting for permissions... ({formatElapsedTime(elapsedTime)})
            </p>
            <p className="text-yellow-300 text-xs mt-2">
              The connection will remain active while you grant permissions
            </p>
          </div>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>🔗 Connection: Active</p>
            <p>👥 Participants: {participants.length}</p>
            <p>⏱️ Timeout: 30 seconds</p>
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p>💡 If you don't see a permission prompt, check your browser's address bar</p>
          </div>
        </div>
      </div>
    );
  }

  // 🎨 PANTALLA DE ERROR MEJORADA
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-4xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
          <p className="text-gray-300 mb-6">{error.message}</p>
          
          {error.userAction && (
            <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg mb-6">
              <p className="text-blue-200">💡 {error.userAction}</p>
            </div>
          )}
          
          <div className="space-x-4 mb-6">
            {error.recoverable !== false && (
              <button
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
            )}
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
              <pre className="text-gray-300 whitespace-pre-wrap">{debugLogs}</pre>
              
              {connectionInfo && (
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <h5 className="text-white font-semibold mb-2">Connection State:</h5>
                  <pre className="text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(connectionInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-400">
            <p className="font-semibold mb-2">Troubleshooting Steps:</p>
            <ul className="list-disc list-inside text-left space-y-1">
              <li>Ensure you're using HTTPS (required for camera access)</li>
              <li>Allow camera and microphone permissions</li>
              <li>Close other apps using the camera</li>
              <li>Try a different browser (Chrome recommended)</li>
              <li>Check your internet connection</li>
              <li>Verify server is accessible at biometricov4.onrender.com</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 🎨 INTERFAZ PRINCIPAL DE VIDEOLLAMADA
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
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <Video className="h-8 w-8 text-gray-400" />
            </div>
          )}
          
          {!isVideoEnabled && localStream && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-gray-400" />
            </div>
          )}
          
          {/* Status Indicator */}
          <div className="absolute top-2 left-2">
            <div className={`w-3 h-3 rounded-full ${
              callState === 'connected' ? 'bg-green-500' :
              callState === 'media_ready' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
          </div>
          
          {/* Media Quality Indicator */}
          {mediaInfo && (
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs text-white">
              {mediaInfo.quality}
              {mediaInfo.isPartial && ' (partial)'}
            </div>
          )}
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
            <pre className="text-gray-300 text-xs whitespace-pre-wrap">{debugLogs}</pre>
            
            {connectionInfo && (
              <div className="mt-2 pt-2 border-t border-gray-600">
                <h5 className="text-white font-semibold mb-1 text-xs">Connection Info:</h5>
                <div className="text-gray-300 text-xs">
                  <p>State: {connectionInfo.state}</p>
                  <p>Socket: {connectionInfo.isConnected ? '✅' : '❌'}</p>
                  <p>Local Stream: {connectionInfo.hasLocalStream ? '✅' : '❌'}</p>
                  <p>Remote Stream: {connectionInfo.hasRemoteStream ? '✅' : '❌'}</p>
                  <p>Peer: {connectionInfo.peerConnectionState || 'none'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Remote Stream Message */}
        {!remoteStream && callState === 'connected' && (
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
          disabled={!localStream}
          className={`p-3 rounded-full transition-colors ${
            isAudioEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
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
          disabled={!localStream}
          className={`p-3 rounded-full transition-colors ${
            isVideoEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? (
            <Video className="h-6 w-6 text-white" />
          ) : (
            <VideoOff className="h-6 w-6 text-white" />
          )}
        </button>

        {(callState === 'error' || callState === 'disconnected') && (
          <button
            onClick={handleRetry}
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