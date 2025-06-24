import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Activity, Wifi, Shield, Camera, Fingerprint, Scan, Eye, TestTube, Wrench } from 'lucide-react';

// Mock del Enhanced VideoCall Manager
const mockEnhancedVideoCallManager = {
  initializeEnhancedVideoCall: async (roomId, userName, isHost, callbacks) => {
    console.log('🚀 Mock Enhanced VideoCall initialized');
    
    // Simular estados de conexión
    setTimeout(() => callbacks.onStateChange('connecting_signaling', 'idle'), 500);
    setTimeout(() => callbacks.onStateChange('signaling_connected', 'connecting_signaling'), 1000);
    setTimeout(() => callbacks.onStateChange('joining_room', 'signaling_connected'), 1500);
    setTimeout(() => callbacks.onStateChange('room_joined', 'joining_room'), 2000);
    setTimeout(() => callbacks.onStateChange('requesting_media', 'room_joined'), 2500);
    setTimeout(() => callbacks.onStateChange('media_ready', 'requesting_media'), 3000);
    setTimeout(() => callbacks.onStateChange('ready', 'media_ready'), 3500);
    
    // Simular stream local
    setTimeout(() => {
      const mockLocalStream = new MediaStream();
      callbacks.onLocalStream(mockLocalStream);
    }, 3000);
    
    // Simular participantes
    setTimeout(() => callbacks.onParticipantsChange([userName, 'Remote User']), 4000);
    
    return { id: 'mock-manager' };
  },
  
  getEnhancedDebugInfo: () => ({
    connectionState: 'ready',
    participants: 2,
    diagnostics: {
      serverReachable: true,
      socketConnected: true,
      roomJoined: true,
      mediaGranted: true,
      peerConnected: true,
      iceConnected: true
    },
    performance: {
      latency: 45,
      jitter: 2,
      packetLoss: 0.1
    }
  }),
  
  toggleEnhancedVideo: () => Math.random() > 0.5,
  toggleEnhancedAudio: () => Math.random() > 0.5,
  cleanupEnhancedVideoCall: () => console.log('🧹 Mock cleanup called')
};

interface EnhancedWebRTCRoomProps {
  userName: string;
  roomId: string;
  onEndCall: () => void;
}

const EnhancedWebRTCRoom: React.FC<EnhancedWebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
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
  
  // Estado para forzar mostrar interfaz
  const [forceShowInterface, setForceShowInterface] = useState(false);
  
  // Estados de animación de escaneo
  const [faceScanning, setFaceScanning] = useState(false);
  const [handScanning, setHandScanning] = useState(false);

  // Debug del estado actual
  useEffect(() => {
    console.log('🔍 DEBUG ESTADO:', {
      connectionState,
      error: !!error,
      forceShowInterface,
      shouldShowMainInterface: forceShowInterface || (!['idle', 'connecting_signaling'].includes(connectionState) && !error)
    });
  }, [connectionState, error, forceShowInterface]);

  // Timeout de emergencia para mostrar interfaz
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      if (['joining_room', 'requesting_media', 'signaling_connected'].includes(connectionState)) {
        console.log('⚠️ EMERGENCY: Forzando interfaz principal por timeout de 10 segundos');
        setForceShowInterface(true);
      }
    }, 10000);

    return () => clearTimeout(emergencyTimeout);
  }, [connectionState]);

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

  // Callback para manejar stream local (sin mostrar)
  const handleLocalStream = useCallback((stream: MediaStream) => {
    console.log("🎥 ENHANCED: Local stream received (hidden):", stream);
    setLocalStream(stream);
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
        
        // Inicializar Enhanced VideoCallManager (usando mock)
        const manager = await mockEnhancedVideoCallManager.initializeEnhancedVideoCall(roomId, userName, isHost, callbacks);
        enhancedManagerRef.current = manager;
        
        console.log('✅ ENHANCED: Enhanced VideoCallManager initialized');
        
        // Actualizar debug info periódicamente
        const debugInterval = setInterval(() => {
          const debug = mockEnhancedVideoCallManager.getEnhancedDebugInfo();
          setDebugInfo(debug);
          setDiagnostics(debug.diagnostics);
        }, 2000);
        
        return () => clearInterval(debugInterval);
        
      } catch (err: any) {
        console.error('❌ ENHANCED: Failed to initialize Enhanced VideoCallManager:', err);
        
        let errorMessage = err.message || 'Unknown connection error';
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
        mockEnhancedVideoCallManager.cleanupEnhancedVideoCall();
        enhancedManagerRef.current = null;
      }
    };
  }, [roomId, userName, handleLocalStream, handleRemoteStream, handleStateChange, handleParticipantsChange, handleError]);

  // Animación de escaneo facial
  const handleFaceScan = () => {
    if (faceScanning) return;
    
    setFaceScanning(true);
    console.log('🔍 Starting face scan animation...');
    
    setTimeout(() => {
      setFaceScanning(false);
      console.log('✅ Face scan animation completed');
    }, 3000);
  };

  // Animación de escaneo de mano
  const handleHandScan = () => {
    if (handScanning) return;
    
    setHandScanning(true);
    console.log('👋 Starting hand scan animation...');
    
    setTimeout(() => {
      setHandScanning(false);
      console.log('✅ Hand scan animation completed');
    }, 3000);
  };

  // Toggle controles
  const handleToggleVideo = () => {
    const enabled = mockEnhancedVideoCallManager.toggleEnhancedVideo();
    setIsVideoEnabled(enabled);
  };

  const handleToggleAudio = () => {
    const enabled = mockEnhancedVideoCallManager.toggleEnhancedAudio();
    setIsAudioEnabled(enabled);
  };

  // Reintentar conexión
  const handleRetry = async () => {
    setError(null);
    setConnectionState('idle');
    setForceShowInterface(false);
    
    if (enhancedManagerRef.current) {
      mockEnhancedVideoCallManager.cleanupEnhancedVideoCall();
      enhancedManagerRef.current = null;
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Finalizar llamada
  const handleEndCall = () => {
    if (enhancedManagerRef.current) {
      mockEnhancedVideoCallManager.cleanupEnhancedVideoCall();
      enhancedManagerRef.current = null;
    }
    onEndCall();
  };

  // Obtener debug info
  const handleGetDebugInfo = () => {
    const debug = mockEnhancedVideoCallManager.getEnhancedDebugInfo();
    setDebugInfo(debug);
    console.log('📊 ENHANCED: Debug Info:', debug);
  };

  // COMPONENTE DE BOTONES DE CONTROL
  const ControlButtons = () => (
    <div className="bg-gray-800 px-6 py-4">
      <div className="flex items-center justify-center space-x-6">
        {/* Controles de Audio/Video */}
        <button
          onClick={handleToggleAudio}
          className={`p-4 rounded-full transition-all duration-200 ${
            isAudioEnabled 
              ? 'bg-gray-600 hover:bg-gray-700 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isAudioEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
        >
          {isAudioEnabled ? (
            <Mic className="h-6 w-6" />
          ) : (
            <MicOff className="h-6 w-6" />
          )}
        </button>

        <button
          onClick={handleToggleVideo}
          className={`p-4 rounded-full transition-all duration-200 ${
            isVideoEnabled 
              ? 'bg-gray-600 hover:bg-gray-700 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isVideoEnabled ? 'Apagar cámara' : 'Encender cámara'}
        >
          {isVideoEnabled ? (
            <Video className="h-6 w-6" />
          ) : (
            <VideoOff className="h-6 w-6" />
          )}
        </button>

        {/* Separador */}
        <div className="h-8 w-px bg-gray-600"></div>

        {/* BOTONES DE ESCANEO */}
        <button
          onClick={handleFaceScan}
          disabled={faceScanning}
          className={`p-4 rounded-full transition-all duration-200 ${
            faceScanning 
              ? 'bg-green-600 animate-pulse text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
          } disabled:opacity-75`}
          title="Escanear rostro"
        >
          <Scan className="h-6 w-6" />
        </button>

        <button
          onClick={handleHandScan}
          disabled={handScanning}
          className={`p-4 rounded-full transition-all duration-200 ${
            handScanning 
              ? 'bg-blue-600 animate-pulse text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
          } disabled:opacity-75`}
          title="Escanear mano"
        >
          <Fingerprint className="h-6 w-6" />
        </button>

        {/* Separador */}
        <div className="h-8 w-px bg-gray-600"></div>

        {/* Botón de Debug */}
        <button
          onClick={handleGetDebugInfo}
          className="p-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-all duration-200 hover:scale-105"
          title="Información de debug"
        >
          <Eye className="h-6 w-6" />
        </button>

        {/* Botón de Colgar */}
        <button
          onClick={handleEndCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200 hover:scale-105"
          title="Colgar llamada"
        >
          <Phone className="h-6 w-6 transform rotate-135" />
        </button>
      </div>

      {/* Indicadores de Estado */}
      <div className="flex items-center justify-center mt-3 space-x-4 text-sm text-gray-400">
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${
            ['peer_connected', 'ready'].includes(connectionState) ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span>Conexión</span>
        </div>
        
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${
            isGuest ? 'bg-blue-500' : 'bg-purple-500'
          }`}></div>
          <span>{isGuest ? 'Invitado' : 'Anfitrión'}</span>
        </div>
        
        {(faceScanning || handScanning) && (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span>Escaneando...</span>
          </div>
        )}

        {/* Indicador de estado actual */}
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${getStateColor().replace('bg-', 'bg-opacity-75 bg-')}`}></div>
          <span className="text-xs">{connectionState}</span>
        </div>
      </div>
    </div>
  );

  // Condiciones para mostrar interfaz principal
  const shouldShowMainInterface = forceShowInterface || (!['idle', 'connecting_signaling'].includes(connectionState) && !error);

  // Pantalla de conexión inicial
  if (['idle', 'connecting_signaling'].includes(connectionState) && !forceShowInterface) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        <div className="flex-1 flex items-center justify-center">
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

            {/* Botón de emergencia para forzar interfaz */}
            {elapsedTime > 8000 && (
              <button
                onClick={() => setForceShowInterface(true)}
                className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Continue Anyway
              </button>
            )}

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
        
        <ControlButtons />
      </div>
    );
  }

  // Pantalla de error mejorada
  if (error && !forceShowInterface) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        <div className="flex-1 flex items-center justify-center">
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
                onClick={() => setForceShowInterface(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg"
              >
                Continue Anyway
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
        
        <ControlButtons />
      </div>
    );
  }

  // INTERFAZ PRINCIPAL - Video Call Interface
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Video Container - Solo Remoto */}
      <div className="flex-1 relative">
        {/* Remote Video - Pantalla Completa */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover bg-gray-800"
          onLoadedMetadata={() => console.log("✅ ENHANCED: Remote video metadata loaded")}
          onPlay={() => console.log("✅ ENHANCED: Remote video started playing")}
          onError={(e) => console.error("❌ ENHANCED: Remote video error:", e)}
        />
        
        {/* Overlay de No Video */}
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center text-white">
              <Camera className="h-24 w-24 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">Waiting for remote video...</h3>
              <p className="text-gray-400">
                {participants.length > 1 ? 'Remote participant is connecting' : 'Waiting for other participants'}
              </p>
            </div>
          </div>
        )}

        {/* Overlay de Estado de Conexión */}
        {!['ready', 'peer_connected'].includes(connectionState) && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-60 rounded-lg px-4 py-2 text-white text-sm">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 animate-pulse" />
              <span>{getStateMessage()}</span>
            </div>
          </div>
        )}

        {/* Overlay de Participantes */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-60 rounded-lg px-4 py-2 text-white text-sm">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Overlay de Animación de Escaneo */}
        {(faceScanning || handScanning) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
            <div className="text-center text-white">
              <div className="relative mb-4">
                {faceScanning && (
                  <div className="border-4 border-green-500 border-dashed rounded-full w-32 h-32 mx-auto animate-spin"></div>
                )}
                {handScanning && (
                  <div className="border-4 border-blue-500 border-dashed rounded-lg w-32 h-32 mx-auto animate-ping"></div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  {faceScanning ? (
                    <Scan className="h-12 w-12 text-green-500 animate-pulse" />
                  ) : (
                    <Fingerprint className="h-12 w-12 text-blue-500 animate-pulse" />
                  )}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {faceScanning ? 'Scanning Face...' : 'Scanning Hand...'}
              </h3>
              <p className="text-gray-300">
                {faceScanning 
                  ? 'Analyzing facial features for biometric verification' 
                  : 'Analyzing hand geometry and fingerprint patterns'
                }
              </p>
              <div className="mt-4 flex justify-center">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        faceScanning ? 'bg-green-500' : 'bg-blue-500'
                      } animate-pulse`}
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overlay de Debug Info (cuando está activado) */}
        {showDebug && debugInfo && (
          <div className="absolute bottom-20 left-4 bg-black bg-opacity-80 rounded-lg p-4 text-white text-xs max-w-md max-h-64 overflow-y-auto">
            <h4 className="font-semibold mb-2 text-purple-300">Enhanced Debug Info</h4>
            <div className="space-y-2">
              <div>
                <span className="text-gray-400">State:</span> 
                <span className="ml-2 text-green-400">{debugInfo.connectionState}</span>
              </div>
              <div>
                <span className="text-gray-400">Participants:</span> 
                <span className="ml-2 text-blue-400">{debugInfo.participants}</span>
              </div>
              {debugInfo.performance && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div className="text-gray-400 mb-1">Performance:</div>
                  <div className="ml-2 space-y-1">
                    <div>Latency: <span className="text-yellow-400">{debugInfo.performance.latency}ms</span></div>
                    <div>Jitter: <span className="text-yellow-400">{debugInfo.performance.jitter}ms</span></div>
                    <div>Packet Loss: <span className="text-yellow-400">{debugInfo.performance.packetLoss}%</span></div>
                  </div>
                </div>
              )}
              {debugInfo.diagnostics && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div className="text-gray-400 mb-1">Diagnostics:</div>
                  <div className="ml-2 grid grid-cols-2 gap-1 text-xs">
                    <div>Server: {debugInfo.diagnostics.serverReachable ? '✅' : '❌'}</div>
                    <div>Socket: {debugInfo.diagnostics.socketConnected ? '✅' : '❌'}</div>
                    <div>Room: {debugInfo.diagnostics.roomJoined ? '✅' : '❌'}</div>
                    <div>Media: {debugInfo.diagnostics.mediaGranted ? '✅' : '❌'}</div>
                    <div>Peer: {debugInfo.diagnostics.peerConnected ? '✅' : '❌'}</div>
                    <div>ICE: {debugInfo.diagnostics.iceConnected ? '✅' : '❌'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Panel de Controles */}
      <ControlButtons />

      {/* Panel de Debug Toggle */}
      {debugInfo && (
        <div className="bg-gray-700 px-4 py-2 text-center">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-300 hover:text-white transition-colors"
          >
            {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
        </div>
      )}
    </div>
  );
};

// Componente wrapper para demostración
const EnhancedWebRTCDemo = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleStartCall = () => {
    if (userName.trim() && roomId.trim()) {
      setIsInCall(true);
    }
  };

  const handleEndCall = () => {
    setIsInCall(false);
  };

  if (isInCall) {
    return (
      <EnhancedWebRTCRoom
        userName={userName}
        roomId={roomId}
        onEndCall={handleEndCall}
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <Shield className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Enhanced WebRTC</h1>
          <p className="text-gray-400">Secure video calling with biometric features</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room ID
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter room ID"
            />
          </div>

          <button
            onClick={handleStartCall}
            disabled={!userName.trim() || !roomId.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Join Enhanced Video Call
          </button>

          <div className="mt-6 text-center text-sm text-gray-400">
            <p className="mb-2">Enhanced Features:</p>
            <div className="flex justify-center space-x-4">
              <div className="flex items-center space-x-1">
                <Scan className="h-4 w-4 text-green-500" />
                <span>Face Scan</span>
              </div>
              <div className="flex items-center space-x-1">
                <Fingerprint className="h-4 w-4 text-blue-500" />
                <span>Hand Scan</span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye className="h-4 w-4 text-purple-500" />
                <span>Debug Mode</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedWebRTCRoom;