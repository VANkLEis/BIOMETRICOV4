import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Activity, Wifi, Shield, Camera, Fingerprint, Scan, Eye, TestTube, Wrench } from 'lucide-react';
import { initializeEnhancedVideoCall, getEnhancedDebugInfo, toggleEnhancedVideo, toggleEnhancedAudio, cleanupEnhancedVideoCall } from '../utils/enhancedVideoCallManager.js';

interface EnhancedWebRTCRoomProps {
  userName: string;
  roomId: string;
  onEndCall: () => void;
}

const EnhancedWebRTCRoom: React.FC<EnhancedWebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null); // 🔧 ADDED: Ref para video local
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
  
  // 🎨 ADDED: Estados de animación de escaneo
  const [faceScanning, setFaceScanning] = useState(false);
  const [handScanning, setHandScanning] = useState(false);

  // 🔧 ADDED: Estado para controlar visibilidad del video local
  const [showLocalVideo, setShowLocalVideo] = useState(true);

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

  // 🔧 FIXED: Callback para manejar stream local CON ASIGNACIÓN DIRECTA
  const handleLocalStream = useCallback((stream: MediaStream) => {
    console.log("🎥 FIXED: Local stream received - ASSIGNING TO VIDEO ELEMENT:", stream);
    console.log("🎥 FIXED: Video tracks:", stream.getVideoTracks().length);
    console.log("🎥 FIXED: Audio tracks:", stream.getAudioTracks().length);
    
    setLocalStream(stream);
    // Agregar al final de los estados existentes
const [forceLocalVideoVisible, setForceLocalVideoVisible] = useState(false);

// Agregar después de los callbacks existentes, antes de la inicialización
const handleForceLocalVideo = useCallback(() => {
 console.log('🔧 FORCE: Forcing local video to be visible and playing');
 setForceLocalVideoVisible(true);
 setShowLocalVideo(true);
    // 🔧 CRITICAL: Asignar stream al elemento video local INMEDIATAMENTE
    const assignStreamToVideo = () => {
      if (localVideoRef.current && stream) {
        console.log("🎥 FIXED: Assigning local stream to video element");
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // CRÍTICO: evitar feedback
        
        // 🔧 FIXED: Forzar reproducción inmediata
        localVideoRef.current.play().then(() => {
          console.log("✅ FIXED: Local video is now playing and visible");
          setShowLocalVideo(true);
        }).catch(error => {
          console.error("❌ FIXED: Local video play failed:", error);
          // Reintentar después de un momento
          setTimeout(() => {
            if (localVideoRef.current && localVideoRef.current.paused) {
              localVideoRef.current.play().catch(console.error);
            }
          }, 1000);
        });
      } else {
        console.error("❌ FIXED: Local video ref is null or stream is null!");
        // Reintentar en el próximo tick
        setTimeout(assignStreamToVideo, 100);
      }
    };
    
    // Ejecutar inmediatamente y también en el próximo tick por si el ref no está listo
    assignStreamToVideo();
    setTimeout(assignStreamToVideo, 50);
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

  // 🎨 ADDED: Animación de escaneo facial
  const handleFaceScan = () => {
    if (faceScanning) return;
    
    setFaceScanning(true);
    console.log('🔍 Starting face scan animation...');
    
    // Animación dura 3 segundos
    setTimeout(() => {
      setFaceScanning(false);
      console.log('✅ Face scan animation completed');
    }, 3000);
  };

  // 🎨 ADDED: Animación de escaneo de mano
  const handleHandScan = () => {
    if (handScanning) return;
    
    setHandScanning(true);
    console.log('👋 Starting hand scan animation...');
    
    // Animación dura 3 segundos
    setTimeout(() => {
      setHandScanning(false);
      console.log('✅ Hand scan animation completed');
    }, 3000);
  };

  // Toggle controles
  const handleToggleVideo = () => {
    const enabled = toggleEnhancedVideo();
    setIsVideoEnabled(enabled);
    
    // 🔧 ADDED: También controlar la visibilidad del video local
    if (localVideoRef.current && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
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

  // 🔧 ADDED: Función para toggle del video local
  const toggleLocalVideoVisibility = () => {
    setShowLocalVideo(!showLocalVideo);
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

  // 🎨 INTERFAZ PRINCIPAL - VIDEO REMOTO + VIDEO LOCAL EN PICTURE-IN-PICTURE
  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Video Container - Remoto como fondo */}
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
        
        {/* 🔧 FIXED: Local Video - Picture-in-Picture (SIEMPRE VISIBLE) */}
        {showLocalVideo && (
          <div className="absolute top-4 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-gray-600 z-30">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                console.log("✅ FIXED: Local video metadata loaded and ready");
              }}
              onPlay={() => {
                console.log("✅ FIXED: Local video started playing");
              }}
              onError={(e) => {
                console.error("❌ FIXED: Local video error:", e);
              }}
            />
            
            {/* Overlay cuando video está deshabilitado */}
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                <VideoOff className="h-8 w-8 text-gray-400" />
              </div>
            )}
            
            {/* Status Indicator */}
            <div className="absolute top-2 left-2">
              <div className={`w-3 h-3 rounded-full ${
                connectionState === 'peer_connected' || connectionState === 'ready' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
            
            {/* Role Indicator */}
            <div className="absolute top-2 right-2">
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                isGuest ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
              }`}>
                {isGuest ? 'Guest' : 'Host'}
              </div>
            </div>

            {/* Toggle Local Video Button */}
            <div className="absolute bottom-2 right-2">
              <button
                onClick={toggleLocalVideoVisibility}
                className="bg-gray-800 bg-opacity-75 hover:bg-opacity-100 text-white p-1 rounded"
                title="Hide/Show local video"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* 🔧 ADDED: Botón para mostrar video local si está oculto */}
        {!showLocalVideo && (
          <div className="absolute top-4 right-4 z-30">
            <button
              onClick={toggleLocalVideoVisibility}
              className="bg-gray-800 bg-opacity-75 hover:bg-opacity-100 text-white p-3 rounded-lg"
              title="Show local video"
            >
              <Camera className="h-6 w-6" />
            </button>
          </div>
        )}
        
        {/* 🎨 ANIMACIONES DE ESCANEO */}
        {faceScanning && (
          <div className="absolute inset-0 pointer-events-none z-20">
            <div className="relative w-full h-full">
              {/* Marco de escaneo facial - Centrado mejor para evitar la barra */}
              <div className="absolute inset-x-0 top-16 bottom-28 border-4 border-green-400 border-dashed animate-pulse">
                <div 
                  className="absolute left-0 right-0 h-1 bg-green-400 shadow-lg"
                  style={{
                    animation: 'faceScan 3s ease-in-out',
                    boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)'
                  }}
                />
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
              </div>
              <div className="absolute inset-x-0 top-16 bottom-28 bg-green-400 bg-opacity-10" />
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-600 bg-opacity-90 text-white px-4 py-2 rounded-lg text-lg font-bold">
                🔍 Escaneando Rostro...
              </div>
              <div className="absolute bottom-32 left-4 right-4 bg-gray-800 bg-opacity-75 rounded-lg p-3">
                <div className="text-green-400 text-sm mb-2">Análisis Facial en Progreso</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-400 h-2 rounded-full"
                    style={{ animation: 'progressBar 3s ease-in-out' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {handScanning && (
          <div className="absolute inset-0 pointer-events-none z-20">
            <div className="relative w-full h-full">
              <div className="absolute inset-x-0 top-16 bottom-28 border-4 border-blue-400 border-dashed animate-pulse">
                <div 
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-4 border-blue-400 rounded-full"
                  style={{
                    animation: 'handScan 3s ease-in-out infinite',
                    boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)',
                    marginTop: '-20px'
                  }}
                />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ marginTop: '-20px' }}>
                  <div className="w-1 h-20 bg-blue-400 absolute -top-10 left-1/2 transform -translate-x-1/2 animate-pulse"></div>
                  <div className="w-1 h-20 bg-blue-400 absolute -bottom-10 left-1/2 transform -translate-x-1/2 animate-pulse"></div>
                  <div className="h-1 w-20 bg-blue-400 absolute -left-10 top-1/2 transform -translate-y-1/2 animate-pulse"></div>
                  <div className="h-1 w-20 bg-blue-400 absolute -right-10 top-1/2 transform -translate-y-1/2 animate-pulse"></div>
                </div>
              </div>
              <div className="absolute inset-x-0 top-16 bottom-28 bg-blue-400 bg-opacity-10" />
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 bg-opacity-90 text-white px-4 py-2 rounded-lg text-lg font-bold">
                👋 Escaneando Mano...
              </div>
              <div className="absolute bottom-32 left-4 right-4 bg-gray-800 bg-opacity-75 rounded-lg p-3">
                <div className="text-blue-400 text-sm mb-2">Análisis Biométrico de Mano</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-400 h-2 rounded-full"
                    style={{ animation: 'progressBar 3s ease-in-out' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INDICADORES SUPERIORES */}
        <div className="absolute top-4 left-4 z-30">
          <div className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStateColor()}`}>
            {getStateMessage()}
          </div>
        </div>

        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
          <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-full text-white text-sm flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {participants.length || 1} participant{(participants.length || 1) !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="absolute top-16 left-4 z-30">
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

        {/* DEBUG PANEL */}
        {showDebug && debugInfo && (
          <div className="absolute top-24 left-4 bg-gray-900 bg-opacity-95 p-3 rounded-lg max-w-md max-h-64 overflow-y-auto z-30">
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
              <p>🔧 Local Video Element: {localVideoRef.current?.srcObject ? '✅' : '❌'}</p>
              <p>🔧 Local Video Playing: {localVideoRef.current && !localVideoRef.current.paused ? '✅' : '❌'}</p>
              <p>🔧 Local Video Visible: {showLocalVideo ? '✅' : '❌'}</p>
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

        {/* MENSAJE DE ESPERA DE PARTICIPANTES */}
        {['media_ready', 'ready'].includes(connectionState) && !remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-10">
            <div className="text-center text-white">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-xl">Waiting for other participants...</p>
              <p className="text-sm text-gray-400 mt-2">Share the room code to invite others</p>
            </div>
          </div>
        )}
      </div>

      {/* 🎨 BARRA DE CONTROLES FIJA - SIEMPRE VISIBLE - Z-INDEX ALTO */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-800 bg-opacity-95 backdrop-blur-sm px-6 py-4 z-40">
        {/* Room ID */}
        <div className="text-center mb-3">
          <span className="text-gray-300 text-sm">Room ID: </span>
          <span className="text-white font-mono bg-gray-700 px-2 py-1 rounded text-sm">{roomId}</span>
        </div>
        
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

          {/* 🎨 BOTONES DE ESCANEO - SIEMPRE ACTIVOS */}
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

          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              showLocalVideo ? 'bg-green-500' : 'bg-gray-500'
            }`}></div>
            <span>Video Local</span>
          </div>
          
          {(faceScanning || handScanning) && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span>Escaneando...</span>
            </div>
          )}
        </div>
      </div>

      {/* 🎨 CSS para animaciones de escaneo */}
      <style jsx>{`
        @keyframes faceScan {
          0% { top: 0; opacity: 1; }
          50% { top: 50%; opacity: 0.8; }
          100% { top: 100%; opacity: 0; }
        }
        
        @keyframes handScan {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
        
        @keyframes progressBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default EnhancedWebRTCRoom;