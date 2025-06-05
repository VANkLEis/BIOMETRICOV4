import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Video } from 'lucide-react';

interface JitsiRoomProps {
  userName: string;
  roomId: string;
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({ userName, roomId }) => {
  const domain = 'meet.jit.si';
  const roomUrl = `https://${domain}/${roomId}#userInfo.displayName="${encodeURIComponent(userName)}"&config.prejoinPageEnabled=false`;
  const [error, setError] = useState<string | null>(null);
  const [useDirectLink, setUseDirectLink] = useState(false);
  const [useIframe, setUseIframe] = useState(false);
  const [loading, setLoading] = useState(true);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const [jitsiApi, setJitsiApi] = useState<any>(null);

  useEffect(() => {
    if (!roomId) return;

    console.log('Inicializando JitsiRoom...', { roomId, userName });

    // Check security context
    const isSecure = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';

    if (!isSecure && !isLocalhost) {
      setError('Esta aplicación requiere una conexión segura (HTTPS) para funcionar correctamente.');
      setLoading(false);
      return;
    }

    // Try API first, fallback to iframe after timeout
    const timer = setTimeout(() => {
      console.log('Timeout alcanzado, cambiando a iframe');
      setUseIframe(true);
      setLoading(false);
    }, 5000);

    loadJitsiAPI().then(() => {
      clearTimeout(timer);
    }).catch(() => {
      clearTimeout(timer);
      console.log('Error cargando API, usando iframe');
      setUseIframe(true);
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      if (jitsiApi) {
        jitsiApi.dispose();
      }
    };
  }, [roomId]);

  const loadJitsiAPI = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('Verificando API de Jitsi...');
      
      if (window.JitsiMeetExternalAPI) {
        console.log('API ya disponible');
        initializeJitsi();
        resolve();
        return;
      }

      console.log('Cargando script...');
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      
      script.onload = () => {
        console.log('Script cargado');
        setTimeout(() => {
          if (window.JitsiMeetExternalAPI) {
            initializeJitsi();
            resolve();
          } else {
            console.log('API no disponible después de cargar script');
            reject(new Error('API not available'));
          }
        }, 500);
      };
      
      script.onerror = () => {
        console.error('Error cargando script');
        reject(new Error('Script load failed'));
      };
      
      document.head.appendChild(script);
    });
  };

  const initializeJitsi = () => {
    if (!jitsiContainerRef.current || !window.JitsiMeetExternalAPI) {
      console.log('Container o API no disponible para inicializar');
      setUseIframe(true);
      setLoading(false);
      return;
    }

    const domain = 'meet.jit.si';
    const roomName = `securecall-${roomId}`;
    
    console.log('Inicializando con API...', { domain, roomName });

    try {
      const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
        },
        userInfo: {
          displayName: userName
        }
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      setJitsiApi(api);
      
      api.addEventListener('videoConferenceJoined', () => {
        console.log('Conferencia iniciada exitosamente');
        setLoading(false);
      });

      api.addEventListener('readyToClose', () => {
        api.dispose();
      });

      // Fallback: si no se une en 10 segundos, mostrar iframe
      setTimeout(() => {
        if (loading) {
          console.log('Timeout de inicialización, cambiando a iframe');
          api.dispose();
          setUseIframe(true);
          setLoading(false);
        }
      }, 10000);

    } catch (err) {
      console.error('Error inicializando:', err);
      setUseIframe(true);
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 p-6">
        <div className="bg-red-900 bg-opacity-50 p-6 rounded-lg max-w-2xl">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-3 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-medium text-red-300">Error de Conexión</h3>
              <p className="mt-2 text-red-200">{error}</p>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => setUseDirectLink(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors mr-2"
                >
                  Usar enlace directo
                </button>
                <button
                  onClick={() => setUseIframe(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Intentar con iframe
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roomName = `securecall-${roomId}`;
  const directLink = `https://meet.jit.si/${roomName}#userInfo.displayName="${encodeURIComponent(userName)}"`;

  if (useDirectLink) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-6">
        <div className="bg-blue-900 bg-opacity-50 p-6 rounded-lg max-w-2xl text-center">
          <Video className="h-12 w-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-300 mb-4">Unirse a la Videollamada</h3>
          <p className="text-blue-200 mb-6">
            Haz clic en el botón para abrir la videollamada en una nueva pestaña:
          </p>
          <a
            href={directLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            <ExternalLink className="h-5 w-5 mr-2" />
            Abrir Videollamada
          </a>
          <p className="text-sm text-blue-300 mt-4">
            Sala: {roomName}
          </p>
        </div>
      </div>
    );
  }

  if (useIframe) {
    return (
      <div className="w-full h-full bg-gray-900">
        <iframe
          src={roomUrl}
          allow="camera; microphone; fullscreen; display-capture; clipboard-write; autoplay"
          style={{ width: '100%', height: '100%', border: '0' }}
          title="Videollamada Jitsi"
          onLoad={() => {
            console.log('Iframe cargado');
            setLoading(false);
          }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-blue-300">Cargando videollamada...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-blue-300 text-lg mb-2">Inicializando videollamada...</p>
          <p className="text-sm text-gray-400 mb-4">Sala: {roomName}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setUseIframe(true);
                setLoading(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors mr-2"
            >
              Usar iframe
            </button>
            <button
              onClick={() => {
                setUseDirectLink(true);
                setLoading(false);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
            >
              Enlace directo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900">
      <div ref={jitsiContainerRef} className="w-full h-full" />
    </div>
  );
};

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default JitsiRoom;