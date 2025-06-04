import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JITSI_SCRIPT_URL = 'https://meet.jit.si/external_api.js';

const JitsiRoom: React.FC = () => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const { roomId } = useParams<{ roomId: string }>();
  const jitsiApiRef = useRef<any>(null);

  const loadJitsiScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = JITSI_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(new Error('Error loading Jitsi script'));
      document.body.appendChild(script);
    });
  };

  const initJitsi = async () => {
    if (!jitsiContainerRef.current) return;

    try {
      await loadJitsiScript();

      const domain = 'meet.jit.si';
      const options = {
        roomName: roomId,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: false,
          prejoinPageEnabled: false
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          MOBILE_APP_PROMO: false,
        },
      };

      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      jitsiApiRef.current.addEventListener('videoConferenceJoined', () => {
        console.log('User has joined the room');
      });

      jitsiApiRef.current.addEventListener('videoConferenceLeft', () => {
        console.log('User has left the room');
      });
    } catch (error) {
      console.error('Failed to initialize Jitsi:', error);
    }
  };

  useEffect(() => {
    initJitsi();

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    };
  }, [roomId]);

  return (
    <div className="w-full h-screen">
      <div ref={jitsiContainerRef} className="w-full h-full" />
    </div>
  );
};

export default JitsiRoom;