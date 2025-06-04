import React, { useEffect, useRef } from 'react';

interface JitsiRoomProps {
  roomId: string;
  userName: string;
  width?: string | number;
  height?: string | number;
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({ 
  roomId, 
  userName, 
  width = '100%', 
  height = '100%' 
}) => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const loadJitsiScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          console.log('Jitsi API already loaded');
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => {
          console.log('Jitsi script loaded successfully');
          resolve();
        };
        script.onerror = () => {
          console.error('Error loading Jitsi script');
          reject(new Error('Failed to load Jitsi script'));
        };
        document.body.appendChild(script);
      });
    };

    const initJitsi = async () => {
      try {
        await loadJitsiScript();

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
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
              'tileview', 'select-background', 'download', 'help', 'mute-everyone'
            ],
            SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar'],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: '#3c3c3c'
          }
        };

        apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

        apiRef.current.addEventListener('videoConferenceJoined', () => {
          console.log('Local user joined');
        });

        apiRef.current.addEventListener('participantJoined', () => {
          console.log('A participant joined');
        });

      } catch (error) {
        console.error('Failed to initialize Jitsi:', error);
      }
    };

    initJitsi();

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [roomId, userName, width, height]);

  return <div ref={jitsiContainerRef} style={{ width, height }} />;
};

export default JitsiRoom;