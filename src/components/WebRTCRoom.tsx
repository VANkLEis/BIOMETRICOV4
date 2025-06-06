import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Users, AlertCircle, RefreshCw, Settings, Play, Clock, Wifi, Activity, Server, TestTube, Eye, Wrench, Scan, Fingerprint, Shield, Camera } from 'lucide-react';
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

  // 🔧 ADDED: Estados específicos para guest
  const [isGuest, setIsGuest] = useState(false);
  const [permissionState, setPermissionState] = useState<string>('unknown');

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

  // 🔧 FIXED: Verificar permisos de cámara antes de inicializar
  const checkCameraPermissions = async () => {
    try {
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setPermissionState(permissions.state);
      
      if (permissions.state === 'denied') {
        setError({
          message: 'Camera access is denied',
          suggestion: 'Please enable camera permissions in your browser settings:\n1. Click the camera icon in the address bar\n2. Select "Allow"\n3. Refresh the page'
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('Cannot check camera permissions:', error);
      return true; // Proceed anyway if we can't check
    }
  };

  // 🚀 INICIALIZACIÓN AUTOMÁTICA con VideoCallManager MEJORADA
  useEffect(() => {
    const initializeCall = async () => {
      try {
        setConnectionState('connecting');
        setJoinStartTime(Date.now());
        setError(null);

        console.log('🚀 GUEST FIXED: Initializing VideoCallManager...');
        
        // 🔧 FIXED: Verificar permisos primero para guests
        const hasPermissions = await checkCameraPermissions();
        if (!hasPermissions) {
          setConnectionState('error');
          return;
        }
        
        // Determinar si es host o guest (simplificado: primer usuario es host)
        const isHost = Math.random() > 0.5; // Para testing, alternar roles
        setIsGuest(!isHost);
        
        console.log(`🎭 GUEST FIXED: Role determined - ${isHost ? 'HOST' : 'GUEST'}`);
        
        // Inicializar VideoCallManager
        const manager = await initializeVideoCall(roomId, userName, isHost);
        videoCallManagerRef.current = manager;
        
        setConnectionState('connected');
        console.log('✅ GUEST FIXED: VideoCallManager initialized successfully');
        
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
        console.error('❌ GUEST FIXED: Failed to initialize VideoCallManager:', err);
        
        // 🔧 FIXED: Manejo específico de errores para guests
        let errorMessage = err.message;
        let suggestion = 'Please check your camera/microphone permissions and internet connection.';
        
        if (err.message.includes('Camera access is denied') || err.message.includes('NotAllowedError')) {
          suggestion = 'Camera access denied. Please:\n1. Click the camera icon in your browser\'s address bar\n2. Select "Allow" for camera and microphone\n3. Refresh the page and try again';
        } else if (err.message.includes('NotFoundError')) {
          suggestion = 'No camera found. Please:\n1. Connect a camera to your device\n2. Make sure it\'s not being used by other apps\n3. Refresh the page and try again';
        } else if (err.message.includes('HTTPS') || err.message.includes('secure')) {
          suggestion = 'Secure connection required. Please:\n1. Make sure you\'re using HTTPS\n2. If testing locally, use localhost instead of IP\n3. Contact support if the problem persists';
        } else if (err.message.includes('Connection timeout') || err.message.includes('server')) {
          suggestion = 'Server connection failed. Please:\n1. Check your internet connection\n2. Wait a moment and try again\n3. The server may be starting up';
        }
        
        setError({
          message: errorMessage,
          suggestion: suggestion,
          originalError: err
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

  // 🔧 FIXED: Reintentar conexión con mejor manejo
  const handleRetry = async () => {
    setError(null);
    setConnectionState('idle');
    
    // Limpiar manager actual
    if (videoCallManagerRef.current) {
      cleanupVideoCall();
      videoCallManagerRef.current = null;
    }
    
    // Verificar permisos de nuevo
    const hasPermissions = await checkCameraPermissions();
    if (!hasPermissions) {
      return;
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
    console.log('📊 GUEST FIXED: Debug Info:', debug);
  };

  // 🔧 ADDED: Función para solicitar permisos manualmente
  const handleRequestPermissions = async () => {
    try {
      setConnectionState('requesting_media');
      
      // Solicitar permisos directamente
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Detener el stream inmediatamente (solo era para permisos)
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      
      // Reinicializar después de obtener permisos
      setTimeout(() => {
        handleRetry();
      }, 1000);
      
    } catch (error: any) {
      console.error('Permission request failed:', error);
      setError({
        message: 'Permission request failed',
        suggestion: 'Please manually enable camera permissions in your browser settings and refresh the page.'
      });
      setConnectionState('error');
    }
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
            {isGuest && <span className="block text-yellow-300 mt-2">Joining as Guest</span>}
          </p>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>Room: {roomId}</p>
            <p>User: {userName}</p>
            <p>Role: {isGuest ? 'Guest' : 'Host'}</p>
            {connectionState === 'connecting' && (
              <p>Time: {formatElapsedTime(elapsedTime)}</p>
            )}
            {permissionState !== 'unknown' && (
              <p>Camera Permission: {permissionState}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 🎨 PANTALLA DE SOLICITUD DE PERMISOS
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
          
          <button
            onClick={handleRequestPermissions}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg mb-4"
          >
            Request Permissions Again
          </button>
          
          <div className="text-sm text-gray-400 space-y-1">
            <p>🔗 Connection: Active</p>
            <p>👥 Participants: {participants.length}</p>
            <p>⏱️ Timeout: 30 seconds</p>
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p>💡 If you don't see a permission prompt:</p>
            <p>1. Check your browser's address bar for a camera icon</p>
            <p>2. Click it and select "Allow"</p>
            <p>3. Refresh the page if needed</p>
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
              <p className="text-blue-200 text-sm whitespace-pre-line">{error.suggestion}</p>
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
            
            {permissionState === 'denied' && (
              <button
                onClick={handleRequestPermissions}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
              >
                <Camera className="h-4 w-4 mr-2" />
                Request Permissions
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
          
          {showDebug && debugInfo && (
            <div className="bg-gray-800 p-4 rounded-lg text-left text-xs max-h-64 overflow-y-auto mb-4">
              <h4 className="text-white font-semibold mb-2">Debug Information:</h4>
              <pre className="text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
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
              <li>Verify server is accessible</li>
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
          
          {/* Role Indicator */}
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
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>

        {/* Debug Info Panel */}
        {showDebug && debugInfo && (
          <div className="absolute top-24 left-4 bg-gray-900 bg-opacity-95 p-3 rounded-lg max-w-md max-h-64 overflow-y-auto">
            <h4 className="text-white font-semibold mb-2 text-sm">Debug Information:</h4>
            <div className="text-gray-300 text-xs space-y-1">
              <p>State: {connectionState}</p>
              <p>Role: {isGuest ? 'Guest' : 'Host'}</p>
              <p>Permission: {permissionState}</p>
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
              <p>Init State: {debugInfo.initializationState || 'unknown'}</p>
              <p>Media State: {debugInfo.mediaRequestState || 'unknown'}</p>
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