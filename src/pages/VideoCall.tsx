import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone } from 'lucide-react';
import DeviceSelector from '../components/DeviceSelector';

const VideoCall: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [primaryStream, setPrimaryStream] = useState<MediaStream | null>(null);
  const [secondaryStream, setSecondaryStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    initializePrimaryCamera();
    return () => {
      if (primaryStream) {
        primaryStream.getTracks().forEach(track => track.stop());
      }
      if (secondaryStream) {
        secondaryStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initializePrimaryCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      
      setPrimaryStream(stream);
      if (primaryVideoRef.current) {
        primaryVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing primary camera:', err);
      setError('Failed to access primary camera');
    }
  };

  const handleSecondaryDeviceSelect = async (deviceId: string) => {
    try {
      // Stop previous secondary stream if it exists
      if (secondaryStream) {
        secondaryStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });
      
      setSecondaryStream(stream);
      if (secondaryVideoRef.current) {
        secondaryVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing secondary camera:', err);
      setError('Failed to access secondary camera');
    }
  };

  const toggleAudio = () => {
    if (primaryStream) {
      const audioTracks = primaryStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (primaryStream) {
      const videoTracks = primaryStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (primaryStream) {
      primaryStream.getTracks().forEach(track => track.stop());
    }
    if (secondaryStream) {
      secondaryStream.getTracks().forEach(track => track.stop());
    }
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {error && (
        <div className="absolute inset-x-0 top-4 flex justify-center z-50">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
            {error}
          </div>
        </div>
      )}

      <div className="flex flex-1">
        <div className="w-1/2 relative bg-black border-r border-gray-800">
          <video
            ref={primaryVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="h-16 w-16 text-gray-400" />
            </div>
          )}
        </div>

        <div className="w-1/2 relative bg-black">
          <video
            ref={secondaryVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 right-4 z-10">
            <DeviceSelector onDeviceSelect={handleSecondaryDeviceSelect} />
          </div>
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