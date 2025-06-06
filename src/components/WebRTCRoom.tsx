import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Play, Clock, Wifi, Activity, Server, TestTube, Eye, Wrench, Scan, Fingerprint } from 'lucide-react';
import { initializeVideoCall, getVideoDebugInfo, toggleVideo as toggleVideoCall, toggleAudio as toggleAudioCall, cleanupVideoCall } from '../utils/videoCallManager.js';

interface WebRTCRoomProps {
  userName: string;
  roomId: string;
  onEndCall: () => void;
}

const WebRTCRoom: React.FC<WebRTCRoomProps> = ({ userName, roomId, onEndCall }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const videoCallManagerRef = useRef<any>(null);
  
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
  
  // 🎨 ADDED: Estados para animaciones de escaneo
  const [faceScanning, setFaceScanning] = useState(false);
  const [fingerprintScanning, setFingerprintScanning] = useState(false);
  
  // Estados de timing
  const [joinStartTime, setJoinStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Actualizar tiempo transcurrido
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (joinStartTime && connectionState !== 'connected') {
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
      case 'connecting':
        return `Connecting... (${formatElapsedTime(elapsedTime)})`;
      case 'requesting_media':
        return `Requesting camera permissions... (${formatElapsedTime(elapsedTime)})`;
      case 'connected':
        return 'Call active - WebRTC';
      case 'error':
        return 'Connection error';
      default:
        return connectionState;
    }
  };

  // Obtener color de estado
  const getStateColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-600';
      case 'requesting_media':
      case 'connecting':
        return 'bg-yellow-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  // 🚀 INICIALIZACIÓN AUTOMÁTICA con VideoCallManager
  useEffect(() => {
    const initializeCall = async () => {
      try {
        setConnectionState('connecting');
        setJoinStartTime(Date.now());
        setError(null);

        console.log('🚀 Initializing VideoCallManager...');
        
        // Determinar si es host (primer usuario o creador del room)
        const isHost = true; // Por simplicidad, siempre host por ahora
        
        // Inicializar VideoCallManager
        const manager = await initializeVideoCall(roomId, userName, isHost);
        videoCallManagerRef.current = manager;
        
        // Configurar referencias de video
        if (localVideoRef.current && manager.localVideo) {
          // El VideoCallManager maneja el video local internamente
          console.log('✅ Local video will be handled by VideoCallManager');
        }
        
        if (remoteVideoRef.current && manager.remoteVideo) {
          // El VideoCallManager maneja el video remoto internamente
          console.log('✅ Remote video will be handled by VideoCallManager');
        }
        
        setConnectionState('connected');
        console.log('✅ VideoCallManager initialized successfully');
        
        // Actualizar debug info periódicamente
        const debugInterval = setInterval(() => {
          const debug = getVideoDebugInfo();
          setDebugInfo(debug);
          
          // Actualizar streams basado en debug info
          if (debug.hasLocalStream && !localStream) {
            setLocalStream(manager.localStream);
          }
          if (debug.hasRemoteStream && !remoteStream) {
            setRemoteStream(manager.remoteStream);
          }
        }, 1000);
        
        return () => clearInterval(debugInterval);
        
      } catch (err: any) {
        console.error('❌ Failed to initialize VideoCallManager:', err);
        setError({
          message: err.message,
          suggestion: 'Please check your camera/microphone permissions and internet connection.'
        });
        setConnectionState('error');
      }
    };

    initializeCall();
    
    // Cleanup al desmontar
    return () => {
      if (videoCallManagerRef.current) {
        cleanupVideoCall();
        videoCallManagerRef.current = null;
      }
    };
  }, [roomId, userName]);

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

  // Toggle controles usando VideoCallManager
  const handleToggleVideo = () => {
    const enabled = toggleVideoCall();
    setIsVideoEnabled(enabled);
  };

  const handleToggleAudio = () => {
    const enabled = toggleAudioCall();
    setIsAudioEnabled(enabled);
  };

  // Reintentar conexión
  const handleRetry = async () => {
    setError(null);
    setConnectionState('idle');
    
    // Limpiar manager actual
    if (videoCallManagerRef.current) {
      cleanupVideoCall();
      videoCallManagerRef.current = null;
    }
    
    // Reinicializar después de un momento
    setTimeout(() => {
      window.location.reload(); // Reiniciar completamente
    }, 1000);
  };

  // Finalizar llamada
  const handleEndCall = () => {
    if (videoCallManagerRef.current) {
      cleanupVideoCall();
      videoCallManagerRef.current = null;
    }
    onEndCall();
  };

  // Obtener debug info
  const handleGetDebugInfo = () => {
    const debug = getVideoDebugInfo();
    setDebugInfo(debug);
    console.log('📊 Debug Info:', debug);
  };

  // 🎨 PANTALLA DE CONEXIÓN
  if (connectionState === 'idle' || connectionState === 'connecting') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-md">
          <div className="relative mb-6">
            <Wifi className="h-16 w-16 text-blue-500 mx-auto animate-pulse" />
            {connectionState === 'connecting' && (
              <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
                {formatElapsedTime(elapsedTime)}
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-bold mb-4">
            {connectionState === 'idle' ? 'Initializing...' : 'Connecting to Room'}
          </h2>
          
          <p className="text-gray-300 mb-6">
            Setting up secure video call with WebRTC...
          </p>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>Room: {roomId}</p>
            <p>User: {userName}</p>
            {connectionState === 'connecting' && (
              <p>Time: {formatElapsedTime(elapsedTime)}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 🎨 PANTALLA DE ERROR
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center p-8 max-w-4xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
          <p className="text-gray-300 mb-2">{error.message}</p>
          
          {error.suggestion && (
            <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg mb-6">
              <p className="text-blue-200 text-sm">{error.suggestion}</p>
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
              <h4 className="text-white font-semibold mb-2">Debug Information:</h4>
              <pre className="text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
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
          
          {/* Status Indicator */}
          <div className="absolute top-2 left-2">
            <div className={`w-3 h-3 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' : 'bg-red-500'
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
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>

        {/* Debug Info Panel */}
        {showDebug && debugInfo && (
          <div className="absolute top-24 left-4 bg-gray-900 bg-opacity-95 p-3 rounded-lg max-w-md max-h-64 overflow-y-auto">
            <h4 className="text-white font-semibold mb-2 text-sm">Debug Information:</h4>
            <div className="text-gray-300 text-xs space-y-1">
              <p>State: {connectionState}</p>
              <p>Local Stream: {debugInfo.hasLocalStream ? '✅' : '❌'}</p>
              <p>Remote Stream: {debugInfo.hasRemoteStream ? '✅' : '❌'}</p>
              <p>Local Canvas: {debugInfo.videoRendererStats?.hasLocalCanvas ? '✅' : '❌'}</p>
              <p>Remote Canvas: {debugInfo.videoRendererStats?.hasRemoteCanvas ? '✅' : '❌'}</p>
              <p>Local Video Ready: {debugInfo.videoRendererStats?.localVideoReady ? '✅' : '❌'}</p>
              <p>Remote Video Ready: {debugInfo.videoRendererStats?.remoteVideoReady ? '✅' : '❌'}</p>
              <p>Frame Count: {debugInfo.frameCount || 0}</p>
              <p>Streaming Active: {debugInfo.streamingActive ? '✅' : '❌'}</p>
              <p>Peer State: {debugInfo.peerConnectionState || 'none'}</p>
              <p>ICE State: {debugInfo.iceConnectionState || 'none'}</p>
            </div>
          </div>
        )}

        {/* No Remote Stream Message */}
        {connectionState === 'connected' && !remoteStream && (
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

        <button
          onClick={handleGetDebugInfo}
          className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
          title="Get debug info"
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