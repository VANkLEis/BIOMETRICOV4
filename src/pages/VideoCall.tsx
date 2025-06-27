import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { Copy, Check } from 'lucide-react';
import RoleSelector from '../components/RoleSelector';
import EnhancedWebRTCRoom from '../components/EnhancedWebRTCRoom';
import Logo from '../components/Logo';

const VideoCall: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { user } = useAuth();
  const { role, setRole } = useRole();
  const [showRoleSelector, setShowRoleSelector] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleRoleSelect = () => {
    setShowRoleSelector(false);
  };

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEndCall = () => {
    setRole(null);
    navigate('/dashboard');
  };

  if (showRoleSelector) {
    return <RoleSelector onSelect={handleRoleSelect} />;
  }

  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Invalid Room</h2>
          <p className="mb-4">No room ID provided</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 overflow-hidden relative">
      <EnhancedWebRTCRoom 
        userName={user?.username || 'Anonymous'} 
        roomId={roomId}
        onEndCall={handleEndCall}
      />

      {/* Room Info Overlay */}
      {role === 'host' && (
        <div className="absolute bottom-20 left-4 bg-gray-800 bg-opacity-90 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Logo className="h-8 w-8" />
            <span className="text-white text-sm">Room: {roomId}</span>
            <button
              onClick={copyRoomCode}
              className="p-1 rounded bg-blue-600 hover:bg-blue-700 transition-colors"
              title="Copy room code"
            >
              {copied ? (
                <Check className="h-4 w-4 text-white" />
              ) : (
                <Copy className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;