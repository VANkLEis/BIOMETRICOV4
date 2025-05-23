import React from 'react';
import { useVerification } from '../contexts/VerificationContext';
import { Check, X } from 'lucide-react';

interface VerificationStatusProps {
  className?: string;
}

const VerificationStatus: React.FC<VerificationStatusProps> = ({ className = '' }) => {
  const { verification, isFullyVerified } = useVerification();
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-1 ${verification.faceVerified ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-xs text-gray-600">Face</span>
        {verification.faceVerified ? (
          <Check className="h-3 w-3 text-green-500 ml-1" />
        ) : (
          <X className="h-3 w-3 text-red-500 ml-1" />
        )}
      </div>
      
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-1 ${verification.fingerprintVerified ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-xs text-gray-600">Fingerprint</span>
        {verification.fingerprintVerified ? (
          <Check className="h-3 w-3 text-green-500 ml-1" />
        ) : (
          <X className="h-3 w-3 text-red-500 ml-1" />
        )}
      </div>
      
      {isFullyVerified && (
        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Verified</span>
      )}
    </div>
  );
};

export default VerificationStatus;