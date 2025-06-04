import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { Copy, Check, Phone } from 'lucide-react';
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

  if (showRoleSelector) {
    return <RoleSelector onSelect={handleRoleSelect} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="flex-1 relative">
        <JitsiRoom
          roomId={roomId}
          userName={user?.username || 'Anonymous'}
          width="100%"
          height="100%"
        />
      </div>

      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex-1"></div>
        <div className="flex items-center space-x-4">
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