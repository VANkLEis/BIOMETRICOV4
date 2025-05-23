import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface VerificationState {
  faceVerified: boolean;
  fingerprintVerified: boolean;
  lastVerified: Date | null;
}

interface VerificationContextType {
  verification: VerificationState;
  isFullyVerified: boolean;
  setFaceVerified: (verified: boolean) => void;
  setFingerprintVerified: (verified: boolean) => void;
  resetVerification: () => void;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

export const useVerification = () => {
  const context = useContext(VerificationContext);
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
};

export const VerificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [verification, setVerification] = useState<VerificationState>({
    faceVerified: false,
    fingerprintVerified: false,
    lastVerified: null
  });

  useEffect(() => {
    // Load verification state from localStorage
    const storedVerification = localStorage.getItem('verification');
    if (storedVerification) {
      const parsedVerification = JSON.parse(storedVerification);
      // Check if verification is older than 24 hours
      const lastVerified = parsedVerification.lastVerified ? new Date(parsedVerification.lastVerified) : null;
      const isExpired = lastVerified ? (new Date().getTime() - lastVerified.getTime()) > 24 * 60 * 60 * 1000 : true;
      
      if (isExpired) {
        resetVerification();
      } else {
        setVerification(parsedVerification);
      }
    }
  }, [user]);

  const updateVerification = (updates: Partial<VerificationState>) => {
    const newState = { ...verification, ...updates };
    setVerification(newState);
    localStorage.setItem('verification', JSON.stringify(newState));
  };

  const setFaceVerified = (verified: boolean) => {
    updateVerification({ 
      faceVerified: verified,
      lastVerified: verified ? new Date() : verification.lastVerified 
    });
  };

  const setFingerprintVerified = (verified: boolean) => {
    updateVerification({ 
      fingerprintVerified: verified,
      lastVerified: verified ? new Date() : verification.lastVerified 
    });
  };

  const resetVerification = () => {
    const resetState = {
      faceVerified: false,
      fingerprintVerified: false,
      lastVerified: null
    };
    setVerification(resetState);
    localStorage.setItem('verification', JSON.stringify(resetState));
  };

  return (
    <VerificationContext.Provider value={{
      verification,
      isFullyVerified: verification.faceVerified && verification.fingerprintVerified,
      setFaceVerified,
      setFingerprintVerified,
      resetVerification
    }}>
      {children}
    </VerificationContext.Provider>
  );
};