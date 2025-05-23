import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVerification } from '../contexts/VerificationContext';
import { Camera, Check, X, RefreshCw } from 'lucide-react';

const FacialVerification: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { setFaceVerified } = useVerification();
  const navigate = useNavigate();

  useEffect(() => {
    const initCamera = async () => {
      try {
        // First try to get user media with ideal constraints
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        }).catch(async () => {
          // If that fails, try with minimal constraints
          return await navigator.mediaDevices.getUserMedia({
            video: true
          });
        });
        
        if (!mediaStream) {
          throw new Error('Failed to get media stream');
        }
        
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          try {
            await videoRef.current.play();
          } catch (playError) {
            console.error('Error playing video:', playError);
            throw new Error('Failed to start video stream');
          }
        }
        
        setError(null);
      } catch (err) {
        console.error('Error accessing camera:', err);
        let errorMessage = 'Unable to access camera. Please ensure:';
        errorMessage += '\n1. You have granted camera permissions';
        errorMessage += '\n2. Your camera is not being used by another application';
        errorMessage += '\n3. You are using a secure connection (HTTPS)';
        setError(errorMessage);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert the captured image to base64 format with JPEG for better performance
        return canvas.toDataURL('image/jpeg', 0.8);
      }
    }
    return null;
  };

  const verifyFace = async () => {
    if (!stream || !stream.active) {
      setError('Camera stream is not active. Please refresh the page and try again.');
      return;
    }

    setVerifying(true);
    setError(null);
    
    setCountdown(3);
    for (let i = 2; i >= 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCountdown(i);
    }
    
    try {
      const imageData = captureImage();
      
      if (!imageData) {
        throw new Error('Failed to capture facial image');
      }

      // Log the first part of the image data to verify capture
      console.log('Captured facial data:', imageData.substring(0, 50) + '...');
      
      // Simulate verification process
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isSuccessful = Math.random() > 0.07;
      
      if (isSuccessful) {
        setSuccess(true);
        setFaceVerified(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('An error occurred during verification. Please try again.');
    } finally {
      setVerifying(false);
      setCountdown(null);
    }
  };

  const retryVerification = () => {
    setVerifying(false);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-6 py-8">
          <div className="text-center mb-8">
            <Camera className="h-12 w-12 text-blue-600 mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Facial Verification</h2>
            <p className="mt-2 text-gray-600">
              Position your face in the center of the frame and stay still for the verification process.
            </p>
          </div>
          
          {error && (
            <div className="mb-6 bg-red-50 p-4 rounded-md border border-red-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <X className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="relative rounded-lg overflow-hidden shadow-inner bg-gray-100 aspect-video max-w-lg mx-auto mb-6">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-dashed border-blue-400 rounded-full w-64 h-64 flex items-center justify-center">
                {countdown !== null && (
                  <div className="bg-blue-600 text-white text-5xl font-bold rounded-full w-24 h-24 flex items-center justify-center">
                    {countdown}
                  </div>
                )}
              </div>
            </div>
            
            {success && (
              <div className="absolute inset-0 bg-green-100 bg-opacity-70 flex items-center justify-center">
                <div className="bg-white p-4 rounded-full">
                  <Check className="h-16 w-16 text-green-500" />
                </div>
              </div>
            )}
            
            {verifying && !countdown && (
              <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
              </div>
            )}
          </div>
          
          <div className="flex justify-center space-x-4">
            {!success && !verifying && (
              <button
                onClick={verifyFace}
                disabled={!stream || verifying}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Camera className="h-5 w-5 mr-2" />
                Verify Face
              </button>
            )}
            
            {error && (
              <button
                onClick={retryVerification}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Try Again
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <p>Tips for successful verification:</p>
            <ul className="list-disc list-inside mt-2 ml-2 space-y-1">
              <li>Make sure your face is well-lit</li>
              <li>Remove sunglasses or any face covering</li>
              <li>Face the camera directly</li>
              <li>Keep a neutral expression</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacialVerification;