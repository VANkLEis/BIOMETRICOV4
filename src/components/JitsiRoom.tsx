import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface JitsiRoomProps {
  userName: string;
  roomId: string;
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({ userName, roomId }) => {
  const [error, setError] = useState<string | null>(null);
  const [useDirectLink, setUseDirectLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiLoaded, setApiLoaded] = useState(false);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) return;

    console.log('Inicializando JitsiRoom...', { roomId, userName });

    // Check if we're in a secure context
    const isSecure = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname);

    console.log('Contexto de seguridad:', { isSecure, isLocalhost, isIPAddress, hostname: window.location.hostname });

    if (!isSecure && !isLocalhost) {
      if (isIPAddress) {
        setError('Para usar videollamadas, por favor utiliza localhost o una conexión HTTPS. Puedes usar ngrok o localtunnel para generar una URL HTTPS temporal.');
      } else {
        setError('Esta aplicación requiere una conexión segura (HTTPS) para funcionar correctamente.');
      }
      setLoading(false);
      return;
    }

    // Try to load Jitsi API
    console.log('Intentando cargar API de Jitsi...');
    loadJitsiAPI();
  }, [roomId]);

  const loadJitsiAPI = () => {
    console.log('Verificando si API ya está cargada...');
    
    // Check if Jitsi API is already loaded
    if (window.JitsiMeetExternalAPI) {
      console.log('API ya está disponible');
      setApiLoaded(true);
      setTimeout(() => initializeJitsi(), 100);
      return;
    }

    console.log('Cargando script de Jitsi API...');
    
    // Load Jitsi API script
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => {
      console.log('Script de Jitsi cargado exitosamente');
      setApiLoaded(true);
      setTimeout(() => initializeJitsi(), 100);
    };
    script.onerror = (err) => {
      console.error('Error cargando script de Jitsi:', err);
      setError('No se pudo cargar la API de Jitsi Meet. Usando enlace directo.');
      setUseDirectLink(true);
      setLoading(false);
    };
    document.head.appendChild(script);
  };

  const initializeJitsi = () => {
    console.log('Inicializando Jitsi...', { 
      containerExists: !!jitsiContainerRef.current, 
      roomId, 
      apiAvailable: !!window.JitsiMeetExternalAPI 
    });

    if (!jitsiContainerRef.current || !roomId) {
      console.error('Container o roomId no disponible');
      setError('Error de configuración. Usando enlace directo.');
      setUseDirectLink(true);
      setLoading(false);
      return;
    }

    if (!window.JitsiMeetExternalAPI) {
      console.error('API de Jitsi no disponible');
      setError('API de Jitsi no disponible. Usando enlace directo.');
      setUseDirectLink(true);
      setLoading(false);
      return;
    }

    if (error && !useDirectLink) {
    const roomName = `securecall-${roomId}`;
    
    console.log('Configurando Jitsi con:', { domain, roomName, userName });
    
    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableWelcomePage: false,
        enableClosePage: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#040404',
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'profile', 'info', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
          'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone'
        ]
      },
      userInfo: {
        displayName: userName
      }
    };

    try {
      console.log('Creando instancia de JitsiMeetExternalAPI...');
      const api = new window.JitsiMeetExternalAPI(domain, options);
      
      api.addEventListener('readyToClose', () => {
        console.log('Jitsi listo para cerrar');
        api.dispose();
      });

      api.addEventListener('videoConferenceJoined', () => {
        console.log('Usuario se unió a la conferencia');
        setLoading(false);
      });

      api.addEventListener('videoConferenceLeft', () => {
        console.log('Usuario abandonó la conferencia');
      });

      api.addEventListener('participantJoined', (participant) => {
        console.log('Participante se unió:', participant);
      });

      // Set loading to false after a short delay
      setTimeout(() => {
        setLoading(false);
      }, 3000);

    } catch (err) {
      console.error('Error inicializando Jitsi:', err);
      setError('Error al inicializar la videollamada. Usando enlace directo.');
      setUseDirectLink(true);
      setLoading(false);
    }
  };

  if (loading && !useDirectLink) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-blue-300">Cargando videollamada...</p>
          <p className="text-sm text-gray-400 mt-2">Sala: securecall-{roomId}</p>
          <button
            onClick={() => {
              console.log('Usuario eligió usar enlace directo');
              setUseDirectLink(true);
              setLoading(false);
            }}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors text-sm"
          >
            Usar enlace directo
          </button>
        </div>
      </div>
    );
  }
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 p-6">
        <div className="bg-yellow-900 bg-opacity-50 p-6 rounded-lg max-w-2xl">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-medium text-yellow-300">Advertencia de Compatibilidad</h3>
              <p className="mt-2 text-yellow-200">{error}</p>
              {/ngrok|localtunnel/.test(error) && (
                <div className="mt-4 space-y-2">
                  <p className="text-yellow-300 font-medium">Soluciones sugeridas:</p>
                  <ul className="list-disc list-inside text-yellow-200 space-y-1">
                    <li>Usa <code className="bg-yellow-900 px-2 py-0.5 rounded">npx localtunnel --port 5173</code> para crear un túnel HTTPS</li>
                    <li>O instala ngrok y ejecuta <code className="bg-yellow-900 px-2 py-0.5 rounded">ngrok http 5173</code></li>
                    <li>Accede a la URL HTTPS generada por cualquiera de estas herramientas</li>
                  </ul>
                </div>
              )}
              <button
                onClick={() => setUseDirectLink(true)}
                className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded transition-colors"
              >
                Usar enlace directo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const domain = 'meet.jit.si';
  const roomName = `securecall-${roomId}`;
  const directLink = `https://${domain}/${roomName}#userInfo.displayName="${encodeURIComponent(userName)}"`;

  if (useDirectLink) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-6">
        <div className="bg-blue-900 bg-opacity-50 p-6 rounded-lg max-w-2xl text-center">
          <h3 className="text-lg font-medium text-blue-300 mb-4">Unirse a la Videollamada</h3>
          <p className="text-blue-200 mb-6">
            Haz clic en el botón de abajo para abrir la videollamada en una nueva pestaña:
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

  return (
    <div className="w-full h-full bg-gray-900 relative">
      <div ref={jitsiContainerRef} className="w-full h-full" />
      {!apiLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-blue-300">Inicializando API...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Declare JitsiMeetExternalAPI for TypeScript
declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default JitsiRoom;