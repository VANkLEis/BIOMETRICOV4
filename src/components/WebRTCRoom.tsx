import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Play, Clock, Wifi, Activity, Server, TestTube, Eye, Wrench, Scan, Fingerprint } from 'lucide-react';
import ConnectionManager from '../utils/connectionManager.js';
import { getUserMedia, stopStream } from '../utils/mediaManager.js';

interface WebRTCRoomProps {
  userName: string;
  roomId: string;
  onEndCall: () => void;
}

const WebRTCRoom: React.FC<WebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  
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
  const [debugLogs, setDebugLogs] = useState<string>('');
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [connectionMethod, setConnectionMethod] = useState<string>('');
  const [connectionTestResults, setConnectionTestResults] = useState<any[]>([]);
  
  // 🔧 FIXED: Estados para diagnóstico de video
  const [videoDiagnosis, setVideoDiagnosis] = useState<any>(null);
  const [showVideoDiagnosis, setShowVideoDiagnosis] = useState(false);
  
  // 🎨 ADDED: Estados para animaciones de escaneo
  const [faceScanning, setFaceScanning] = useState(false);
  const [fingerprintScanning, setFingerprintScanning] = useState(false);
  
  // Estados de timing
  const [joinStartTime, setJoinStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Actualizar tiempo transcurrido
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (joinStartTime && connectionState !== 'peer_connected' && connectionState !== 'socket_streaming') {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - joinStartTime);
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [joinStartTime, connectionState]);

  // Formatear tiempo transcurrido
  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  // Obtener mensaje de estado para UI
  const getStateMessage = () => {
    switch (connectionState) {
      case 'idle':
        return 'Initializing...';
      case 'joining':
        return `Connecting to room... (${formatElapsedTime(elapsedTime)})`;
      case 'connected':
        return 'Connected to room - Ready for video';
      case 'requesting_media':
        return `Requesting camera permissions... (${formatElapsedTime(elapsedTime)})`;
      case 'media_ready':
        return 'Media ready - Waiting for participants...';
      case 'peer_connected':
        return `Call active via ${connectionMethod}`;
      case 'socket_streaming':
        return 'Call active via Socket.IO streaming';
      case 'disconnected':
        return 'Disconnected - Attempting reconnection...';
      case 'error':
        return 'Connection error';
      default:
        return connectionState;
    }
  };

  // Obtener color de estado
  const getStateColor = () => {
    switch (connectionState) {
      case 'peer_connected':
      case 'socket_streaming':
        return 'bg-green-600';
      case 'requesting_media':
      case 'joining':
        return 'bg-yellow-600';
      case 'connected':
      case 'media_ready':
        return 'bg-blue-600';
      case 'error':
        return 'bg-red-600';
      case 'disconnected':
        return 'bg-orange-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Inicializar ConnectionManager
  useEffect(() => {
    const connectionManager = new ConnectionManager();
    connectionManagerRef.current = connectionManager;
    
    // Configurar callbacks
    connectionManager.setCallbacks({
      onStateChange: (newState: string, oldState: string, data: any) => {
        console.log(`🔄 State change: ${oldState} → ${newState}`, data);
        setConnectionState(newState);
        
        // Detectar método de conexión
        if (newState === 'peer_connected') {
          setConnectionMethod('WebRTC');
        } else if (newState === 'socket_streaming') {
          setConnectionMethod('Socket.IO');
          
          // 🔧 FIXED: Configurar renderizado remoto cuando inicia Socket.IO streaming
          if (remoteVideoRef.current) {
            try {
              connectionManager.setupRemoteVideoRenderer(remoteVideoRef.current);
              console.log('✅ Remote video renderer configured for Socket.IO streaming');
            } catch (error) {
              console.error('❌ Failed to setup remote video renderer:', error);
            }
          }
        }
        
        // Actualizar información de conexión
        setConnectionInfo(connectionManager.getState());
      },
      
      onParticipantsChange: (newParticipants: string[]) => {
        console.log('👥 Participants changed:', newParticipants);
        setParticipants(newParticipants);
      },
      
      onRemoteStream: (stream: MediaStream | null) => {
        console.log('📺 Remote stream:', stream ? 'received' : 'cleared');
        setRemoteStream(stream);
        
        // 🔧 FIXED: Asignar stream remoto directamente para WebRTC
        if (remoteVideoRef.current && stream) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(console.error);
        }
      },
      
      onError: (errorInfo: any) => {
        console.error('❌ Connection error:', errorInfo);
        setError(errorInfo);
      },
      
      onDebug: (logMessage: string) => {
        setDebugLogs(prev => prev + '\n' + logMessage);
      }
    });
    
    return () => {
      connectionManager.cleanup();
    };
  }, []);

  // Auto-join al montar el componente
  useEffect(() => {
    if (connectionState === 'idle') {
      handleJoinRoom();
    }
  }, []);

  // Unirse al room
  const handleJoinRoom = async () => {
    if (!connectionManagerRef.current) return;
    
    try {
      setError(null);
      setJoinStartTime(Date.now());
      
      console.log('🚀 Starting room join process...');
      
      await connectionManagerRef.current.joinRoom(roomId, userName, true);
      
      console.log('✅ Room joined successfully');
      
    } catch (err: any) {
      console.error('❌ Failed to join room:', err);
      setError(err);
    }
  };

  // 🔧 FIXED: Solicitar medios y configurar renderizado local CORRECTAMENTE
  const handleRequestMedia = async () => {
    if (!connectionManagerRef.current) return;
    
    try {
      setError(null);
      setConnectionState('requesting_media');
      
      console.log('🎥 Starting media request...');
      
      const result = await getUserMedia({
        quality: 'medium',
        video: true,
        audio: true,
        fallbackToAudioOnly: true,
        allowPartialSuccess: true
      });
      
      console.log('✅ Media obtained:', result);
      
      setLocalStream(result.stream);
      
      // 🔧 FIXED: CRÍTICO - Configurar renderizado local ANTES de agregar al connection manager
      if (localVideoRef.current && result.stream) {
        console.log('🎥 FIXED: Setting up local video display...');
        
        // Asignar stream directamente al elemento video local
        localVideoRef.current.srcObject = result.stream;
        localVideoRef.current.muted = true; // CRÍTICO para evitar feedback
        localVideoRef.current.autoplay = true;
        localVideoRef.current.playsInline = true;
        
        // Forzar reproducción
        try {
          await localVideoRef.current.play();
          console.log('✅ FIXED: Local video is now visible and playing');
        } catch (playError) {
          console.error('❌ FIXED: Local video play error:', playError);
        }
      }
      
      // 🔧 FIXED: Agregar stream al connection manager DESPUÉS de configurar visualización
      await connectionManagerRef.current.addLocalStream(result.stream, localVideoRef.current);
      
      console.log('✅ FIXED: Stream added to connection manager with local video rendering');
      
    } catch (err: any) {
      console.error('❌ Failed to get media:', err);
      setError(err);
      setConnectionState('connected'); // Volver al estado anterior
    }
  };

  // 🔧 FIXED: Diagnóstico de video mejorado
  const handleVideoDiagnosis = () => {
    if (!connectionManagerRef.current) return;
    
    try {
      const diagnosis = connectionManagerRef.current.diagnoseVideoIssues();
      setVideoDiagnosis(diagnosis);
      setShowVideoDiagnosis(true);
      
      console.log('🔍 FIXED: Video diagnosis completed:', diagnosis);
    } catch (error) {
      console.error('❌ Video diagnosis failed:', error);
      alert('❌ Video diagnosis failed: ' + error.message);
    }
  };

  // 🔧 FIXED: Reparación de video mejorada
  const handleVideoRepair = () => {
    if (!connectionManagerRef.current) return;
    
    try {
      const repairs = connectionManagerRef.current.repairVideoRendering();
      console.log('🔧 FIXED: Video repair completed:', repairs);
      
      // 🔧 FIXED: Reparación adicional para video local
      if (localVideoRef.current && localStream) {
        console.log('🔧 FIXED: Additional local video repair...');
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(console.error);
      }
      
      // Actualizar diagnóstico después de la reparación
      setTimeout(() => {
        handleVideoDiagnosis();
      }, 1000);
      
      alert(`✅ FIXED: Video repair completed. Applied: ${repairs.join(', ')}`);
    } catch (error) {
      console.error('❌ Video repair failed:', error);
      alert('❌ Video repair failed: ' + error.message);
    }
  };

  // 🔧 FIXED: Test visual de video mejorado
  const handleVideoTest = () => {
    if (!connectionManagerRef.current) return;
    
    try {
      const testElement = connectionManagerRef.current.createVideoTest();
      console.log('🧪 FIXED: Video test created');
      alert('✅ FIXED: Video test created! Check the visual test panel.');
    } catch (error) {
      console.error('❌ Video test failed:', error);
      alert('❌ Video test failed: ' + error.message);
    }
  };

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

  // 🎨 ADDED: Animación de escaneo de huella
  const handleFingerprintScan = () => {
    if (fingerprintScanning) return;
    
    setFingerprintScanning(true);
    console.log('👆 Starting fingerprint scan animation...');
    
    // Animación dura 3 segundos
    setTimeout(() => {
      setFingerprintScanning(false);
      console.log('✅ Fingerprint scan animation completed');
    }, 3000);
  };

  // Toggle controles
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

  // Reintentar conexión
  const handleRetry = async () => {
    if (!connectionManagerRef.current) return;
    
    setError(null);
    
    // Limpiar y empezar de nuevo
    connectionManagerRef.current.cleanup();
    
    // Reinicializar
    const connectionManager = new ConnectionManager();
    connectionManagerRef.current = connectionManager;
    
    // Reconfigurar callbacks
    connectionManager.setCallbacks({
      onStateChange: (newState: string, oldState: string, data: any) => {
        setConnectionState(newState);
        setConnectionInfo(connectionManager.getState());
        
        if (newState === 'peer_connected') {
          setConnectionMethod('WebRTC');
        } else if (newState === 'socket_streaming') {
          setConnectionMethod('Socket.IO');
          
          // Configurar renderizado remoto para Socket.IO
          if (remoteVideoRef.current) {
            try {
              connectionManager.setupRemoteVideoRenderer(remoteVideoRef.current);
            } catch (error) {
              console.error('❌ Failed to setup remote video renderer on retry:', error);
            }
          }
        }
      },
      onParticipantsChange: setParticipants,
      onRemoteStream: (stream: MediaStream | null) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current && stream) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(console.error);
        }
      },
      onError: setError,
      onDebug: (logMessage: string) => {
        setDebugLogs(prev => prev + '\n' + logMessage);
      }
    });
    
    await handleJoinRoom();
  };

  // Finalizar llamada
  const handleEndCall = () => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.cleanup();
    }
    
    if (localStream) {
      stopStream(localStream);
      setLocalStream(null);
    }
    
    onEndCall();
  };

  // Test de conectividad mejorado
  const handleConnectionTest = async () => {
    try {
      setConnectionTestResults([]);
      
      if (connectionManagerRef.current) {
        const results = await connectionManagerRef.current.testConnection();
        setConnectionTestResults(results);
        
        const successfulConnections = results.filter(r => r.status === 'success');
        
        if (successfulConnections.length > 0) {
          const fastest = successfulConnections.reduce((prev, current) => 
            (prev.responseTime < current.responseTime) ? prev : current
          );
          alert(`✅ Server reachable!\nFastest: ${fastest.server}\nResponse time: ${fastest.responseTime}ms`);
        } else {
          alert('❌ No servers are reachable. Please check:\n1. Internet connection\n2. Server is running\n3. Firewall settings');
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('❌ Connection test failed: ' + error.message);
    }
  };

  // 🎨 PANTALLA DE INICIO - Esperando conexión inicial
  if (connectionState === 'idle' || connectionState === 'joining') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <div className="relative mb-6">
            <Wifi className="h-16 w-16 text-blue-500 mx-auto animate-pulse" />
            {connectionState === 'joining' && (
              <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
                {formatElapsedTime(elapsedTime)}
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-bold mb-4">
            {connectionState === 'idle' ? 'Initializing...' : 'Connecting to Room'}
          </h2>
          
          <p className="text-gray-300 mb-6">
            {connectionState === 'idle' 
              ? 'Setting up the connection system...'
              : 'Establishing secure connection to the server...'
            }
          </p>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>Room: {roomId}</p>
            <p>User: {userName}</p>
            {connectionState === 'joining' && (
              <p>Time: {formatElapsedTime(elapsedTime)}</p>
            )}
          </div>
          
          {error && (
            <div className="mt-6 space-y-2">
              <button
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg mr-2"
              >
                Retry Connection
              </button>
              <button
                onClick={handleConnectionTest}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg"
              >
                Test Server
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 🎨 PANTALLA DE ACTIVACIÓN DE MEDIOS
  if (connectionState === 'connected') {
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

  // 🎨 PANTALLA DE SOLICITUD DE MEDIOS
  if (connectionState === 'requesting_media') {
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
          </div>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>🔗 Connection: Active</p>
            <p>👥 Participants: {participants.length}</p>
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
          <p className="text-gray-300 mb-2">{error.message}</p>
          
          {error.suggestion && (
            <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg mb-6">
              <div className="flex items-start">
                <Server className="h-5 w-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-blue-200 text-sm text-left">{error.suggestion}</p>
              </div>
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
              onClick={handleConnectionTest}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Activity className="h-4 w-4 mr-2" />
              Test Server
            </button>
            <button
              onClick={handleVideoDiagnosis}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Eye className="h-4 w-4 mr-2" />
              Video Diagnosis
            </button>
            <button
              onClick={handleVideoRepair}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Wrench className="h-4 w-4 mr-2" />
              Repair Video
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
          
          {/* Connection Test Results */}
          {connectionTestResults.length > 0 && (
            <div className="bg-gray-800 p-4 rounded-lg text-left text-sm mb-4">
              <h4 className="text-white font-semibold mb-2">Server Connection Test Results:</h4>
              {connectionTestResults.map((result, index) => (
                <div key={index} className={`p-2 rounded mb-2 ${
                  result.status === 'success' ? 'bg-green-900 bg-opacity-30' : 'bg-red-900 bg-opacity-30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">{result.server}</span>
                    <span className={result.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                      {result.status === 'success' ? `✅ ${result.responseTime}ms` : '❌ Failed'}
                    </span>
                  </div>
                  {result.error && (
                    <p className="text-red-300 text-xs mt-1">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* 🔧 FIXED: Video Diagnosis Panel */}
          {showVideoDiagnosis && videoDiagnosis && (
            <div className="bg-gray-800 p-4 rounded-lg text-left text-xs mb-4">
              <h4 className="text-white font-semibold mb-2">Video Diagnosis Results:</h4>
              <pre className="text-gray-300 whitespace-pre-wrap overflow-auto max-h-64">
                {JSON.stringify(videoDiagnosis, null, 2)}
              </pre>
            </div>
          )}
          
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
        
        {/* 🎨 ADDED: Animaciones de escaneo sobre el video remoto */}
        {faceScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full">
              {/* Barra de escaneo facial que baja */}
              <div 
                className="absolute left-0 right-0 h-1 bg-green-400 shadow-lg"
                style={{
                  animation: 'faceScan 3s ease-in-out',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)'
                }}
              />
              {/* Overlay de escaneo */}
              <div className="absolute inset-0 bg-green-400 bg-opacity-10 border-2 border-green-400 border-dashed animate-pulse" />
              {/* Texto de escaneo */}
              <div className="absolute top-4 left-4 bg-green-600 bg-opacity-90 text-white px-3 py-1 rounded-lg text-sm font-medium">
                🔍 Scanning Face...
              </div>
            </div>
          </div>
        )}
        
        {fingerprintScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full">
              {/* Círculo pulsante para huella */}
              <div 
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-blue-400 rounded-full"
                style={{
                  animation: 'fingerprintScan 3s ease-in-out infinite',
                  boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)'
                }}
              />
              {/* Overlay de escaneo */}
              <div className="absolute inset-0 bg-blue-400 bg-opacity-10 animate-pulse" />
              {/* Texto de escaneo */}
              <div className="absolute top-4 left-4 bg-blue-600 bg-opacity-90 text-white px-3 py-1 rounded-lg text-sm font-medium">
                👆 Scanning Fingerprint...
              </div>
            </div>
          </div>
        )}
        
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
              connectionState === 'peer_connected' || connectionState === 'socket_streaming' ? 'bg-green-500' :
              connectionState === 'media_ready' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
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
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Debug Toggle */}
        <div className="absolute top-16 left-4 space-y-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="bg-gray-800 bg-opacity-75 px-2 py-1 rounded text-white text-xs hover:bg-opacity-100 block"
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
          
          <button
            onClick={handleVideoDiagnosis}
            className="bg-purple-800 bg-opacity-75 px-2 py-1 rounded text-white text-xs hover:bg-opacity-100 block"
          >
            Video Diagnosis
          </button>
          
          <button
            onClick={handleVideoRepair}
            className="bg-orange-800 bg-opacity-75 px-2 py-1 rounded text-white text-xs hover:bg-opacity-100 block"
          >
            Repair Video
          </button>
          
          <button
            onClick={handleVideoTest}
            className="bg-green-800 bg-opacity-75 px-2 py-1 rounded text-white text-xs hover:bg-opacity-100 block"
          >
            Test Video
          </button>
        </div>

        {/* Debug Info Panel */}
        {showDebug && (
          <div className="absolute top-24 left-4 bg-gray-900 bg-opacity-95 p-3 rounded-lg max-w-md max-h-64 overflow-y-auto">
            <h4 className="text-white font-semibold mb-2 text-sm">Debug Information:</h4>
            <div className="text-gray-300 text-xs space-y-1">
              <p>State: {connectionState}</p>
              <p>Method: {connectionMethod || 'None'}</p>
              <p>Participants: {participants.length}</p>
              <p>Local Stream: {localStream ? '✅' : '❌'}</p>
              <p>Remote Stream: {remoteStream ? '✅' : '❌'}</p>
              {connectionInfo?.serverUrl && (
                <p>Server: {connectionInfo.serverUrl}</p>
              )}
            </div>
            
            {connectionInfo && (
              <div className="mt-2 pt-2 border-t border-gray-600">
                <pre className="text-gray-300 text-xs whitespace-pre-wrap">
                  {JSON.stringify(connectionInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* No Remote Stream Message */}
        {!remoteStream && (connectionState === 'peer_connected' || connectionState === 'socket_streaming' || connectionState === 'media_ready') && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
            <div className="text-center text-white">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-xl">
                {connectionState === 'media_ready' 
                  ? 'Waiting for other participants...' 
                  : 'Waiting for other participants to join...'
                }
              </p>
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

        {/* 🎨 ADDED: Botones de animación de escaneo */}
        <button
          onClick={handleFaceScan}
          disabled={faceScanning}
          className={`p-3 rounded-full transition-colors ${
            faceScanning ? 'bg-green-600 animate-pulse' : 'bg-green-600 hover:bg-green-700'
          } disabled:opacity-50`}
          title="Face scan animation (local only)"
        >
          <Scan className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleFingerprintScan}
          disabled={fingerprintScanning}
          className={`p-3 rounded-full transition-colors ${
            fingerprintScanning ? 'bg-blue-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-50`}
          title="Fingerprint scan animation (local only)"
        >
          <Fingerprint className="h-6 w-6 text-white" />
        </button>

        {(connectionState === 'error' || connectionState === 'disconnected') && (
          <button
            onClick={handleRetry}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
            title="Retry connection"
          >
            <RefreshCw className="h-6 w-6 text-white" />
          </button>
        )}

        <button
          onClick={handleConnectionTest}
          className="p-3 rounded-full bg-gray-600 hover:bg-gray-700 transition-colors"
          title="Test connection"
        >
          <Activity className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleVideoDiagnosis}
          className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
          title="Diagnose video issues"
        >
          <Eye className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleVideoRepair}
          className="p-3 rounded-full bg-orange-600 hover:bg-orange-700 transition-colors"
          title="Repair video rendering"
        >
          <Wrench className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleVideoTest}
          className="p-3 rounded-full bg-green-600 hover:bg-green-700 transition-colors"
          title="Test video rendering"
        >
          <TestTube className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={handleEndCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="End call"
        >
          <Phone className="h-6 w-6 text-white transform rotate-135" />
        </button>
      </div>

      {/* 🎨 ADDED: CSS para animaciones de escaneo */}
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

export default WebRTCRoom;