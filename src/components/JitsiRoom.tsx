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
  const [apiLoaded, setApiLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jitsiApiRef = useRef<any>(null);

  const loadJitsiScript = () => {
    if (window.JitsiMeetExternalAPI) {
      setApiLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => setApiLoaded(true);
    script.onerror = () => setError('Failed to load Jitsi Meet API');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  };

  useEffect(() => {
    loadJitsiScript();
  }, []);

  useEffect(() => {
    if (!apiLoaded || !jitsiContainerRef.current) return;

    try {
      const domain = 'meet.jit.si';
      const options = {
        roomName: roomId,
        width: width,
        height: height,
        parentNode: jitsiContainerRef.current,
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
      };

      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      jitsiApiRef.current.addEventListener('videoConferenceJoined', () => {
        console.log('User joined the conference');
      });

      jitsiApiRef.current.addEventListener('videoConferenceLeft', () => {
        console.log('User left the conference');
      });

      return () => {
        if (jitsiApiRef.current) {
          jitsiApiRef.current.dispose();
        }
      };
    } catch (err) {
      console.error('Error initializing Jitsi Meet:', err);
      setError('Failed to initialize video conference');
    }
  }, [apiLoaded, roomId, userName, width, height]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!apiLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return <div ref={jitsiContainerRef} style={{ width, height }} />;
};

export default JitsiRoom;