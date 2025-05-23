import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone, Users } from 'lucide-react';
import RoleSelector from '../components/RoleSelector';
import WebRTCService from '../services/webrtc';

const VideoCall: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [signalData, setSignalData] = useState<string>('');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!role || !roomId || !user) return;

    const initializeCall = async () => {
      try {
        setConnectionError(null);
        
        // Get local stream first
        const stream = await WebRTCService.getLocalStream();
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize WebRTC
        await WebRTCService.initialize(role === 'interviewer');

        // Set up event listeners
        const handleRemoteStream = (event: CustomEvent<MediaStream>) => {
          const stream = event.detail;
          setRemoteStream(stream);
          
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        };

        const handlePeerSignal = (event: CustomEvent) => {
          setSignalData(JSON.stringify(event.detail));
        };

        window.addEventListener('remoteStream', handleRemoteStream as EventListener);
        window.addEventListener('peerSignal', handlePeerSignal as EventListener);

        return () => {
          window.removeEventListener('remoteStream', handleRemoteStream as EventListener);
          window.removeEventListener('peerSignal', handlePeerSignal as EventListener);
        };
      } catch (err) {
        console.error('Error initializing call:', err);
        setConnectionError(err instanceof Error ? err.message : 'Failed to initialize call');
      }
    };

    initializeCall();

    return () => {
      WebRTCService.disconnect();
    };
  }, [role, roomId, user, navigate]);

  const handleSignalInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const signal = JSON.parse(event.target.value);
      WebRTCService.signalPeer(signal);
    } catch (err) {
      console.error('Invalid signal data:', err);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    WebRTCService.disconnect();
    navigate('/dashboard');
  };

  const handleRoleSelected = () => {
    setShowRoleSelector(false);
  };

  if (showRoleSelector) {
    return <RoleSelector onSelect={handleRoleSelected} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {connectionError && (
        <div className="absolute inset-x-0 top-4 flex justify-center z-50">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
            {connectionError}
          </div>
        </div>
      )}

      <div className="flex flex-1">
        <div className="w-1/2 relative bg-black border-r border-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="h-16 w-16 text-gray-400" />
            </div>
          )}
        </div>

        <div className="w-1/2 relative bg-black">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Users className="h-24 w-24 text-gray-500 opacity-50 mb-4" />
              <div className="bg-gray-800 p-4 rounded-lg max-w-md w-full">
                <p className="text-white text-center mb-2">Share this connection data with the other participant:</p>
                <textarea
                  readOnly
                  className="w-full h-32 bg-gray-700 text-white rounded p-2 mb-2"
                  value={signalData}
                />
                <p className="text-white text-center mb-2">Paste their connection data here:</p>
                <textarea
                  className="w-full h-32 bg-gray-700 text-white rounded p-2"
                  onChange={handleSignalInput}
                  placeholder="Paste connection data here..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 px-6 py-3 flex items-center justify-center space-x-4">
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full ${isAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {isAudioMuted ? (
            <MicOff className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {isVideoOff ? (
            <VideoOff className="h-6 w-6 text-white" />
          ) : (
            <VideoIcon className="h-6 w-6 text-white" />
          )}
        </button>
        
        <button
          onClick={endCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700"
        >
          <Phone className="h-6 w-6 text-white transform rotate-135" />
        </button>
      </div>
    </div>
  );
};

export default VideoCall;