import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';

interface JitsiRoomProps {
  userName: string;
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({ userName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { roomId } = useParams<{ roomId: string }>();

  useEffect(() => {
    if (!containerRef.current || !roomId) return;

    const domain = 'meet.jit.si';
    const roomName = `securecall-${roomId}`;

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = `https://${domain}/${roomName}`;
    iframe.allow = 'camera; microphone; fullscreen; display-capture; clipboard-write';
    iframe.style.height = '100%';
    iframe.style.width = '100%';
    iframe.style.border = '0';

    // Clear and append
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(iframe);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [roomId]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
};

export default JitsiRoom;