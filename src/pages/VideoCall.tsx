import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { Copy, Check, Phone } from 'lucide-react';
import RoleSelector from '../components/RoleSelector';
import JitsiRoom from '../components/JitsiRoom';

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

  const endCall = () => {
    setRole(null);
    navigate('/dashboard');
  };

  if (showRoleSelector) {
    return <RoleSelector onSelect={handleRoleSelect} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
      <div className="flex-1 relative">
        <JitsiRoom userName={user?.username || 'Anonymous'} />
      </div>

      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {role === 'host' && roomId && (
            <button
              onClick={copyRoomCode}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-700"
              title="Copy room code"
            >
              {copied ? <Check className="h-6 w-6 text-white" /> : <Copy className="h-6 w-6 text-white" />}
            </button>
          )}
        </div>

        <button
          onClick={endCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700"
          title="End call"
        >
          <Phone className="h-6 w-6 text-white transform rotate-135" />
        </button>
      </div>
    </div>
  );
};

export default VideoCall;