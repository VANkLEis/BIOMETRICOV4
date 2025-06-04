import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface JitsiRoomProps {
  userName: string;
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({ userName }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Check if we're in a secure context
    const isSecure = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname);

    if (!isSecure && !isLocalhost) {
      if (isIPAddress) {
        setError('Para usar videollamadas, por favor utiliza localhost o una conexión HTTPS. Puedes usar ngrok o localtunnel para generar una URL HTTPS temporal.');
      } else {
        setError('Esta aplicación requiere una conexión segura (HTTPS) para funcionar correctamente.');
      }
      return;
    }
  }, [roomId]);

  if (error) {
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  const domain = 'meet.jit.si';
  const roomName = `securecall-${roomId}`;
  const embedDomain = window.location.hostname === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname)
    ? 'secure-alpha-murex.vercel.app'
    : window.location.hostname;

  return (
    <div className="w-full h-full">
      <iframe
        src={`https://${domain}/${roomName}?embedDomain=${embedDomain}#userInfo.displayName="${userName}"`}
        allow="camera; microphone; fullscreen; display-capture; clipboard-write"
        style={{ width: '100%', height: '100%', border: '0' }}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
};

export default JitsiRoom;