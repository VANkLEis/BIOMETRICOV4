import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { Scan, Hand } from 'lucide-react';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JITSI_SCRIPT_URL = 'https://meet.jit.si/external_api.js';

interface ScanningOverlayProps {
  type: 'face' | 'fingerprint';
  onComplete: () => void;
}

const ScanningOverlay: React.FC<ScanningOverlayProps> = ({ type, onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 3000; // 3 seconds
    const interval = 50; // Update every 50ms
    const steps = duration / interval;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500);
          return 100;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="relative w-64 h-64 bg-gray-900 rounded-lg overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {type === 'face' ? (
            <Scan className="h-24 w-24 text-blue-500 animate-pulse" />
          ) : (
            <Hand className="h-24 w-24 text-blue-500 animate-pulse" />
          )}
          <p className="mt-4 text-white text-lg font-semibold">
            Scanning {type === 'face' ? 'Face' : 'Fingerprint'}...
          </p>
          <p className="text-blue-400 mt-2">{Math.round(progress)}%</p>
        </div>
      </div>
    </div>
  );
};

const JitsiRoom: React.FC = () => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const { roomId } = useParams<{ roomId: string }>();
  const jitsiApiRef = useRef<any>(null);
  const { role } = useRole();
  const [scanning, setScanning] = useState<'face' | 'fingerprint' | null>(null);

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
          prejoinPageEnabled: false,
          disableDeepLinking: true
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          MOBILE_APP_PROMO: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          HIDE_INVITE_MORE_HEADER: true
        },
      };

      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      jitsiApiRef.current.addEventListener('videoConferenceJoined', () => {
        console.log('User has joined the room');
      });

      jitsiApiRef.current.addEventListener('videoConferenceLeft', () => {
        console.log('User has left the room');
      });

      // Custom event handlers for scanning
      jitsiApiRef.current.addEventListener('incomingMessage', (event: any) => {
        if (event.data?.scanType) {
          setScanning(event.data.scanType);
        }
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

  const handleScanComplete = () => {
    setScanning(null);
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('sendEndpointMessage', '', {
        scanComplete: true,
        type: scanning
      });
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div ref={jitsiContainerRef} className="w-full h-full" />
      {scanning && role === 'guest' && (
        <ScanningOverlay type={scanning} onComplete={handleScanComplete} />
      )}
    </div>
  );
};

export default JitsiRoom;