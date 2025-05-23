import React, { useEffect, useState } from 'react';
import { useRole } from '../contexts/RoleContext';
import { UserSquare2, Users } from 'lucide-react';
import WebRTCService from '../services/webrtc';

interface RoleSelectorProps {
  onSelect: () => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelect }) => {
  const { setRole } = useRole();
  const [hasMediaAccess, setHasMediaAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Request media access when component mounts
    const requestMediaAccess = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop tracks after permission check
        setHasMediaAccess(true);
        setError(null);
      } catch (err) {
        console.error('Media access error:', err);
        setError('Please grant camera and microphone permissions to continue');
        setHasMediaAccess(false);
      }
    };

    requestMediaAccess();
  }, []);

  const handleRoleSelect = async (selectedRole: 'interviewer' | 'interviewee') => {
    if (!hasMediaAccess) {
      setError('Please grant camera and microphone permissions to continue');
      return;
    }

    try {
      await WebRTCService.initializeDevices();
      setRole(selectedRole);
      onSelect();
    } catch (err) {
      console.error('Error initializing devices:', err);
      setError('Failed to initialize video devices');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-6">Select Your Role</h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => handleRoleSelect('interviewer')}
            className="flex items-center justify-center p-6 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-colors"
            disabled={!hasMediaAccess}
          >
            <UserSquare2 className="h-8 w-8 text-blue-600 mr-3" />
            <span className="text-lg font-medium">Interviewer</span>
          </button>
          <button
            onClick={() => handleRoleSelect('interviewee')}
            className="flex items-center justify-center p-6 border-2 border-green-500 rounded-lg hover:bg-green-50 transition-colors"
            disabled={!hasMediaAccess}
          >
            <Users className="h-8 w-8 text-green-600 mr-3" />
            <span className="text-lg font-medium">Interviewee</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelector;