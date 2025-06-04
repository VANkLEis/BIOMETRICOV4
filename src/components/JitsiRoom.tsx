import React, { useEffect, useRef, useState } from 'react';

interface JitsiRoomProps {
  roomId: string;
  userName: string;
  width?: string | number;
  height?: string | number;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({
  roomId,
  userName,
  width = '100%',
  height = '100%'
}) => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const jitsiApiRef = useRef<any>(null);

  useEffect(() => {
    const loadJitsiScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          console.log('Jitsi API already loaded.');
          resolve();
        } else if (document.querySelector('script[src="https://meet.jit.si/external_api.js"]')) {
          console.log('Script already in DOM, waiting...');
          const interval = setInterval(() => {
            if (window.JitsiMeetExternalAPI) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(interval);
            reject(new Error('Timeout waiting for Jitsi API'));
          }, 5000);
        } else {
          const script = document.createElement('script');
          script.src = 'https://meet.jit.si/external_api.js';
          script.async = true;
          script.onload = () => {
            console.log('Jitsi script loaded.');
            resolve();
          };
          script.onerror = () => {
            console.error('Error loading Jitsi script');
            reject(new Error('Failed to load Jitsi API'));
          };
          document.body.appendChild(script);
        }
      });
    };

    let api: any = null;
    loadJitsiScript()
      .then(() => {
        if (!jitsiContainerRef.current) return;

        api = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName: roomId,
          parentNode: jitsiContainerRef.current,
          width,
          height,
          userInfo: {
            displayName: userName
          },
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: true,
            startWithVideoMuted: false,
            disableDeepLinking: true
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
              'tileview', 'select-background', 'download', 'help', 'mute-everyone'
            ],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: '#111827'
          }
        });

        jitsiApiRef.current = api;

        api.addEventListener('videoConferenceJoined', () => {
          console.log('User joined the conference');
        });

        api.addEventListener('videoConferenceLeft', () => {
          console.log('User left the conference');
        });
      })
      .catch((err) => {
        console.error('Failed to load Jitsi Meet API:', err);
        setError(err.message);
      });

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [roomId, userName, width, height]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div 
      ref={jitsiContainerRef} 
      style={{ width, height }} 
      className="bg-gray-900"
    />
  );
};

export default JitsiRoom;