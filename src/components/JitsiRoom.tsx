import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface JitsiRoomProps {
  userName: string;
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({ userName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { roomId } = useParams<{ roomId: string }>();
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !roomId) return;

    // Check if we're in a secure context
    const isSecure = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname);

    if (!isSecure && !isLocalhost && !isIPAddress) {
      setError('Esta aplicación requiere una conexión segura (HTTPS) para funcionar correctamente.');
      return;
    }

    try {
      // Create iframe
      const iframe = document.createElement('iframe');
      const domain = 'meet.jit.si';
      const roomName = `securecall-${roomId}`;
      
      // Set iframe attributes
      iframe.src = `https://${domain}/${roomName}#userInfo.displayName="${userName}"&embedDomain=${window.location.hostname}`;
      iframe.allow = 'camera; microphone; fullscreen; display-capture; clipboard-write';
      iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';

      // Add load event listener
      iframe.onload = () => {
        setError(null);
      };

      iframe.onerror = () => {
        setError('No se pudo cargar la videollamada. Por favor, verifica tu conexión a internet.');
      };

      // Clear and append
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(iframe);
      }
    } catch (err) {
      console.error('Error creating Jitsi iframe:', err);
      setError('Ocurrió un error al inicializar la videollamada. Por favor, recarga la página.');
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [roomId, userName]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 p-6">
        <div className="bg-yellow-900 bg-opacity-50 p-6 rounded-lg max-w-2xl">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-medium text-yellow-300">Error de Conexión</h3>
              <p className="mt-2 text-yellow-200">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
};

export default JitsiRoom;