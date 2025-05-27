// PeerJS server configuration
export const peerConfig = {
  // PeerJS server configuration for production
  SERVER_URL: 'secure-call-cmdy.onrender.com',
  SERVER_PORT: 443,
  SERVER_PATH: '/peerjs',
  
  // PeerJS configuration
  CONFIG: {
    debug: 3,
    secure: true,
    host: 'secure-call-cmdy.onrender.com',
    port: 443,
    path: '/peerjs',
    pingInterval: 3000, // Reduced ping interval for faster connection loss detection
    retryTimer: 3000,   // Reduced retry timer for faster reconnection
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    }
  }
};

// Helper function to get full server URL
export const getPeerServerUrl = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isLocalhost) {
    return {
      host: 'secure-call-cmdy.onrender.com',
      port: 443,
      path: '/peerjs',
      secure: true,
      config: peerConfig.CONFIG.config,
      debug: 3,
      pingInterval: 3000,
      retryTimer: 3000
    };
  }

  // Development configuration
  return {
    host: 'localhost',
    port: 3000,
    path: '/peerjs',
    secure: false,
    config: peerConfig.CONFIG.config,
    debug: 3,
    pingInterval: 3000,
    retryTimer: 3000
  };
};