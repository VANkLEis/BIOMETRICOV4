// PeerJS server configuration
export const peerConfig = {
  // PeerJS server configuration for production
  SERVER_URL: 'securecall-signaling.onrender.com',
  SERVER_PORT: 443,
  SERVER_PATH: '/peerjs',
  
  // PeerJS configuration
  CONFIG: {
    debug: 3,
    secure: true,
    host: 'securecall-signaling.onrender.com',
    port: 443,
    path: '/peerjs',
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
  
  return {
    host: isLocalhost ? window.location.hostname : peerConfig.SERVER_URL,
    port: isLocalhost ? window.location.port : peerConfig.SERVER_PORT,
    path: peerConfig.SERVER_PATH,
    secure: !isLocalhost,
    config: peerConfig.CONFIG.config,
    debug: 3
  };
};