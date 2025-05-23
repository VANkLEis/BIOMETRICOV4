import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone, Users, MessageSquare, Camera, Fingerprint, UserPlus, Copy, Check, AlertTriangle } from 'lucide-react';
import RoleSelector from '../components/RoleSelector';
import DeviceSelector from '../components/DeviceSelector';
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
  const [isCalling, setIsCalling] = useState(true);
  const [connectionEstablished, setConnectionEstablished] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ sender: string; text: string; timestamp: Date }[]>([]);
  const [showRoleSelector, setShowRoleSelector] = useState(true);
  const [participantCount, setParticipantCount] = useState(1);
  const [verifyingBiometrics, setVerifyingBiometrics] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);
  const [biometricStatus, setBiometricStatus] = useState<{
    face: boolean;
    fingerprint: boolean;
  }>({ face: false, fingerprint: false });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const reconnectTimeoutRef = useRef<number>();

  useEffect(() => {
    if (!role || !roomId || !user) return;

    const initializeWebRTC = async () => {
      try {
        setConnectionError(null);
        await WebRTCService.initialize(user.id.toString());
        const stream = await WebRTCService.getLocalStream();
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Handle incoming streams
        window.addEventListener('remoteStream', ((event: CustomEvent) => {
          setRemoteStream(event.detail);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.detail;
          }
          setConnectionEstablished(true);
          setIsCalling(false);
          setParticipantCount(2);
        }) as EventListener);

        // Handle call ended
        window.addEventListener('callEnded', () => {
          setConnectionEstablished(false);
          setParticipantCount(1);
        });

        // Handle connection errors
        window.addEventListener('peerError', ((event: CustomEvent) => {
          const errorMessage = event.detail?.message || 'Connection error occurred';
          setConnectionError(errorMessage);
          setIsCalling(false);
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeoutRef.current = window.setTimeout(() => {
            initializeWebRTC();
          }, 5000);
        }) as EventListener);

        if (role === 'interviewer') {
          // Wait for interviewee to join
          setIsCalling(true);
        } else {
          // Join existing call
          await WebRTCService.makeCall(roomId);
        }
      } catch (err) {
        console.error('Error initializing WebRTC:', err);
        setConnectionError('Failed to connect to video call. Please check your network connection and try again.');
        setIsCalling(false);
      }
    };

    initializeWebRTC();

    return () => {
      WebRTCService.disconnect();
      window.removeEventListener('remoteStream', () => {});
      window.removeEventListener('callEnded', () => {});
      window.removeEventListener('peerError', () => {});
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [role, roomId, user]);

  const handleDeviceSelect = async (deviceId: string) => {
    try {
      await WebRTCService.setVideoDevice(deviceId);
      const newStream = await WebRTCService.getLocalStream();
      setLocalStream(newStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error('Error changing device:', err);
      setConnectionError('Failed to switch camera device. Please try again.');
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    WebRTCService.disconnect();
    navigate('/dashboard');
  };

  const verifyBiometric = async (type: 'face' | 'fingerprint') => {
    if (role !== 'interviewer') return;
    
    setVerifyingBiometrics(true);
    setBiometricType(type);
    setScanProgress(0);
    
    // Capture remote video frame
    if (remoteVideoRef.current) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = remoteVideoRef.current.videoWidth;
        canvas.height = remoteVideoRef.current.videoHeight;
        context.drawImage(remoteVideoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Simulate scanning progress
        const interval = setInterval(() => {
          setScanProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              return 100;
            }
            return prev + 2;
          });
        }, 50);
        
        // Simulate verification process
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        clearInterval(interval);
        setScanProgress(100);
        
        setTimeout(() => {
          setBiometricStatus(prev => ({
            ...prev,
            [type]: true
          }));
          setVerifyingBiometrics(false);
          setBiometricType(null);
        }, 500);
      }
    }
  };

  const handleRoleSelected = () => {
    setShowRoleSelector(false);
  };

  const copyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/video-call/${roomId}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetryConnection = () => {
    setIsCalling(true);
    setConnectionError(null);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    WebRTCService.disconnect();
    WebRTCService.initialize(user?.id.toString() || '').then(() => {
      if (role === 'interviewee') {
        WebRTCService.makeCall(roomId || '');
      }
    }).catch(err => {
      console.error('Retry connection failed:', err);
      setConnectionError('Failed to reconnect. Please check your network connection and try again.');
      setIsCalling(false);
    });
  };

  if (showRoleSelector) {
    return <RoleSelector onSelect={handleRoleSelected} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Connection Error Message */}
      {connectionError && (
        <div className="absolute inset-x-0 top-4 flex justify-center z-50">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center">
            <AlertTriangle className="h-6 w-6 mr-2" />
            <span>{connectionError}</span>
            <button
              onClick={handleRetryConnection}
              className="ml-4 bg-white text-red-500 px-3 py-1 rounded hover:bg-red-100 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Call Status */}
      {isCalling && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-90">
          <div className="text-center text-white">
            <div className="animate-ping inline-flex h-24 w-24 rounded-full bg-blue-400 opacity-75 mb-4"></div>
            <h2 className="text-2xl font-semibold mb-2">Connecting to call...</h2>
            <p className="text-gray-300">Room ID: {roomId}</p>
          </div>
        </div>
      )}

      {/* Rest of the component remains unchanged */}
      {/* Biometric Verification Animation */}
      {verifyingBiometrics && biometricType && (
        <div className="absolute right-0 top-0 bottom-0 w-1/2 z-50 flex items-center justify-center bg-gray-900 bg-opacity-90">
          <div className="text-center text-white">
            <div className="relative mb-8">
              {biometricType === 'face' ? (
                <div className="w-64 h-64 border-4 border-blue-500 rounded-full flex items-center justify-center">
                  <div className="absolute w-full h-full">
                    <div 
                      className="h-1 bg-blue-500 transition-transform duration-50"
                      style={{ 
                        transform: `translateY(${(scanProgress / 100) * 256}px)`,
                        opacity: 0.5
                      }}
                    />
                  </div>
                  <Camera className="h-24 w-24 text-blue-500" />
                </div>
              ) : (
                <div className="w-48 h-64 border-4 border-blue-500 rounded-lg flex items-center justify-center">
                  <div className="absolute w-full h-full">
                    <div 
                      className="w-1 bg-blue-500 transition-transform duration-50"
                      style={{ 
                        transform: `translateX(${(scanProgress / 100) * 192}px)`,
                        opacity: 0.5,
                        height: '100%'
                      }}
                    />
                  </div>
                  <Fingerprint className="h-24 w-24 text-blue-500" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              Scanning {biometricType === 'face' ? 'Face' : 'Fingerprint'}...
            </h2>
            <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-50"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="mt-2 text-gray-400">{scanProgress}%</p>
          </div>
        </div>
      )}
      
      {/* Main call interface */}
      <div className="flex flex-1 overflow-hidden">
        {/* Split screen layout */}
        <div className="flex flex-1">
          {/* Interviewer's video (left side) */}
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
            {role === 'interviewer' && (
              <div className="absolute top-4 left-4">
                <DeviceSelector onDeviceSelect={handleDeviceSelect} />
              </div>
            )}
          </div>

          {/* Interviewee's video (right side) */}
          <div className="w-1/2 relative bg-black">
            {connectionEstablished ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="h-24 w-24 text-gray-500 opacity-50" />
              </div>
            )}
            {role === 'interviewee' && (
              <div className="absolute top-4 right-4">
                <DeviceSelector onDeviceSelect={handleDeviceSelect} />
              </div>
            )}
          </div>
        </div>

        {/* Chat sidebar */}
        {chatOpen && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-medium text-white">Chat</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex flex-col ${msg.sender === user?.username ? 'items-end' : 'items-start'}`}
                >
                  <div className={`rounded-lg px-3 py-2 max-w-xs ${
                    msg.sender === user?.username 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-100'
                  }`}>
                    <p>{msg.text}</p>
                  </div>
                  <span className="text-xs text-gray-500 mt-1">
                    {msg.sender} · {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-700">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (message.trim()) {
                  setMessages([...messages, {
                    sender: user?.username || '',
                    text: message,
                    timestamp: new Date()
                  }]);
                  setMessage('');
                }
              }} className="flex">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 bg-gray-700 text-white rounded-l-md px-3 py-2 focus:outline-none"
                  placeholder="Type a message..."
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Call controls */}
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
        
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`p-3 rounded-full ${chatOpen ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          <MessageSquare className="h-6 w-6 text-white" />
        </button>

        {role === 'interviewer' && (
          <>
            <button
              onClick={() => verifyBiometric('face')}
              disabled={verifyingBiometrics || biometricStatus.face}
              className={`p-3 rounded-full ${
                biometricStatus.face 
                  ? 'bg-green-500 cursor-not-allowed' 
                  : verifyingBiometrics 
                  ? 'bg-gray-500 cursor-not-allowed' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Camera className="h-6 w-6 text-white" />
            </button>
            
            <button
              onClick={() => verifyBiometric('fingerprint')}
              disabled={verifyingBiometrics || biometricStatus.fingerprint}
              className={`p-3 rounded-full ${
                biometricStatus.fingerprint 
                  ? 'bg-green-500 cursor-not-allowed' 
                  : verifyingBiometrics 
                  ? 'bg-gray-500 cursor-not-allowed' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Fingerprint className="h-6 w-6 text-white" />
            </button>
          </>
        )}

        <button
          onClick={() => setShowInvite(!showInvite)}
          className={`p-3 rounded-full ${showInvite ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          <UserPlus className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Invite overlay */}
      {showInvite && (
        <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-90 rounded-lg p-4 w-96">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-semibold">Invite Participant</h3>
            <button 
              onClick={() => setShowInvite(false)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="bg-gray-900 rounded p-2 flex items-center mb-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/video-call/${roomId}`}
              className="bg-transparent text-white flex-1 outline-none text-sm"
            />
            <button
              onClick={copyInviteLink}
              className="ml-2 p-1 rounded hover:bg-gray-700"
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <Copy className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            Share this link with the participant you want to invite.
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoCall;