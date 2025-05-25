import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone, Scan, Hand, Copy, Check } from 'lucide-react';
import WebRTCService from '../services/webrtc';

const VideoCall: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { user } = useAuth();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState<'face' | 'hand' | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [connecting, setConnecting] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        setConnecting(true);
        setError(null);

        // The user who creates the call (navigates directly to /video-call) is the host
        const isCreatingCall = !roomId;
        setIsHost(isCreatingCall);

        // Generate unique peer ID
        const peerId = isCreatingCall 
          ? `host-${user?.id}-${Date.now()}`  // Host ID format
          : `guest-${user?.id}-${Date.now()}`; // Guest ID format

        await WebRTCService.initialize(peerId);
        
        // Get and set local stream
        const stream = await WebRTCService.getLocalStream();
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Set up event listeners
        const handleRemoteStream = (event: CustomEvent) => {
          setConnecting(false);
          const stream = event.detail;
          setRemoteStream(stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        };

        const handlePeerError = (event: CustomEvent) => {
          setConnecting(false);
          setError(event.detail.message);
        };

        const handlePeerConnected = () => {
          console.log('Peer connected successfully');
          if (!isCreatingCall && roomId) {
            console.log('Guest initiating call to host:', roomId);
            WebRTCService.callPeer(roomId);
          }
        };

        window.addEventListener('remoteStream', handleRemoteStream as EventListener);
        window.addEventListener('peerError', handlePeerError as EventListener);
        window.addEventListener('peerConnected', handlePeerConnected as EventListener);

        return () => {
          window.removeEventListener('remoteStream', handleRemoteStream as EventListener);
          window.removeEventListener('peerError', handlePeerError as EventListener);
          window.removeEventListener('peerConnected', handlePeerConnected as EventListener);
        };
      } catch (err) {
        console.error('Error initializing call:', err);
        setError('Failed to initialize video call');
        setConnecting(false);
      }
    };

    initializeCall();

    return () => {
      WebRTCService.disconnect();
    };
  }, [roomId, user]);

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

  const copyRoomLink = () => {
    const currentRoomId = WebRTCService.getCurrentPeerId();
    if (currentRoomId) {
      const link = `${window.location.origin}/video-call/${currentRoomId}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startScanning = (type: 'face' | 'hand') => {
    if (isScanning) return;
    
    setIsScanning(true);
    setScanType(type);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsScanning(false);
            setScanType(null);
            setScanProgress(0);
          }, 1000);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  const endCall = () => {
    WebRTCService.disconnect();
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
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded-full text-white text-sm">
            You ({isHost ? 'Host' : 'Guest'})
          </div>
        </div>

        <div className="w-1/2 relative bg-black">
          {remoteStream ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded-full text-white text-sm">
                {isHost ? 'Guest' : 'Host'}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 p-6">
              {isHost ? (
                <>
                  <h3 className="text-xl text-white mb-4">Share this link to invite someone</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/video-call/${WebRTCService.getCurrentPeerId()}`}
                      className="bg-gray-700 text-white px-4 py-2 rounded-l-md w-96"
                    />
                    <button
                      onClick={copyRoomLink}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-md flex items-center"
                    >
                      {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <h3 className="text-xl text-white mb-4">Connecting to host...</h3>
                  {connecting && (
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="relative w-64 h-64">
                <div 
                  className="absolute inset-0 border-4 border-blue-500 rounded-lg"
                  style={{
                    clipPath: `inset(${100 - scanProgress}% 0 0 0)`
                  }}
                />
                
                <div className="absolute inset-0 flex items-center justify-center">
                  {scanType === 'face' ? (
                    <Scan className="h-24 w-24 text-blue-500 animate-pulse" />
                  ) : (
                    <Hand className="h-24 w-24 text-blue-500 animate-pulse" />
                  )}
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 text-center text-white font-bold">
                  Scanning... {scanProgress}%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
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
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => startScanning('face')}
            disabled={isScanning}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Scan className="h-6 w-6 text-white" />
          </button>
          
          <button
            onClick={() => startScanning('hand')}
            disabled={isScanning}
            className="p-3 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Hand className="h-6 w-6 text-white" />
          </button>
          
          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700"
          >
            <Phone className="h-6 w-6 text-white transform rotate-135" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;