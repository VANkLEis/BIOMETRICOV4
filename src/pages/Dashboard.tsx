import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVerification } from '../contexts/VerificationContext';
import { Camera, Fingerprint, Video, UserPlus, CheckCircle, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { verification, isFullyVerified } = useVerification();
  const [roomId, setRoomId] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const navigate = useNavigate();
  
  const generateRoomId = () => {
    return uuidv4().substring(0, 8);
  };

  const createNewCall = () => {
    if (!isFullyVerified) {
      return;
    }
    
    const newRoomId = generateRoomId();
    navigate(`/video-call/${newRoomId}`);
  };

  const joinCall = () => {
    if (!isFullyVerified || !roomId) {
      return;
    }
    
    navigate(`/video-call/${roomId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Welcome, {user?.username}</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Before you can make a video call, you need to complete the biometric verification process.
          </p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Facial Verification</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                {verification.faceVerified ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span>Verified</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    <span className="mr-2">Not verified</span>
                    <Link 
                      to="/verify/face" 
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Verify Now
                    </Link>
                  </>
                )}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Fingerprint Verification</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                {verification.fingerprintVerified ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span>Verified</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    <span className="mr-2">Not verified</span>
                    <Link 
                      to="/verify/fingerprint" 
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Fingerprint className="h-4 w-4 mr-1" />
                      Verify Now
                    </Link>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Video Calls</h3>
          <div className="mt-5">
            <div className="rounded-md bg-blue-50 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Video className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Secure Video Calls</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      {isFullyVerified ? 
                        "You have completed the biometric verification process and can now make secure video calls." : 
                        "Please complete the biometric verification process to enable secure video calls."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={createNewCall}
                disabled={!isFullyVerified}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isFullyVerified ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <Video className="h-5 w-5 mr-2" />
                Start a New Video Call
              </button>

              <div className="flex items-center">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-gray-500 text-sm">or</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>

              <div>
                <label htmlFor="room-id" className="block text-sm font-medium text-gray-700">
                  Join an existing call
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    name="room-id"
                    id="room-id"
                    className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                    placeholder="Enter room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    disabled={!isFullyVerified}
                  />
                  <button
                    type="button"
                    onClick={joinCall}
                    disabled={!isFullyVerified || !roomId}
                    className={`inline-flex items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white ${
                      isFullyVerified && roomId ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500' : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Join Call
                  </button>
                </div>
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(!showInvite)}
                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Invite a Friend
                </button>
              </div>

              {showInvite && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Share this link with your friend</h4>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-md sm:text-sm border-gray-300 bg-gray-100"
                      value={`${window.location.origin}/video-call/${generateRoomId()}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/video-call/${generateRoomId()}`);
                      }}
                      className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;