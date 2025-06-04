import React, { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { Copy, Check, Phone, Scan, Hand } from 'lucide-react';
import RoleSelector from '../components/RoleSelector';
import JitsiRoom from '../components/JitsiRoom';
import { v4 as uuidv4 } from 'uuid';

const VideoCall: React.FC = () => {
  const navigate = useNavigate();
  const { roomId: paramRoomId } = useParams();
  const { user } = useAuth();
  const { role, setRole } = useRole();
  const [showRoleSelector, setShowRoleSelector] = useState(true);
  const [roomId] = useState(paramRoomId || uuidv4().substring(0, 8));
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleRoleSelect = () => {
    setShowRoleSelector(false);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const endCall = () => {
    setRole(null);
    navigate('/dashboard');
  };

  const startScanning = useCallback((type: 'face' | 'fingerprint') => {
    if (scanning) return;
    setScanning(true);
    // Send message to guest through Jitsi API
    const event = new CustomEvent('startScan', { detail: { type } });
    window.dispatchEvent(event);
    setTimeout(() => setScanning(false), 3500);
  }, [scanning]);

  if (showRoleSelector) {
    return <RoleSelector onSelect={handleRoleSelect} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
      <div className="flex-1 relative">
        <JitsiRoom
          roomId={roomId}
          userName={user?.username || 'Anonymous'}
          width="100%"
          height="100%"
        />
      </div>

      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        {role === 'host' && (
          <div className="flex items-center space-x-4">
            <button
              onClick={() => startScanning('face')}
              disabled={scanning}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Scan className="h-5 w-5 text-white" />
              <span className="text-white text-sm">Scan Face</span>
            </button>
            <button
              onClick={() => startScanning('fingerprint')}
              disabled={scanning}
              className="p-3 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Hand className="h-5 w-5 text-white" />
              <span className="text-white text-sm">Scan Fingerprint</span>
            </button>
          </div>
        )}

        <div className="flex items-center space-x-4 ml-auto">
          {role === 'host' && (
            <button
              onClick={copyRoomCode}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-700"
              title="Copy room code"
            >
              {copied ? <Check className="h-6 w-6 text-white" /> : <Copy className="h-6 w-6 text-white" />}
            </button>
          )}
          
          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700"
            title="End call"
          >
            <Phone className="h-6 w-6 text-white transform rotate-135" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;