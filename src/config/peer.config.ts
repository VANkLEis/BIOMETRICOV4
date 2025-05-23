// PeerJS server configuration
export const peerConfig = {
  // PeerJS server configuration for local network
  SERVER_URL: window.location.hostname,
  SERVER_PORT: 443,
  SERVER_PATH: '/peerjs',
  
  // PeerJS configuration
  CONFIG: {
    debug: 3,
    secure: true,
    host: window.location.hostname,
    port: 443,
    path: '/peerjs',
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  }
};

// Helper function to get full server URL
export const getPeerServerUrl = () => {
  return {
    host: window.location.hostname,
    port: peerConfig.SERVER_PORT,
    path: peerConfig.SERVER_PATH,
    secure: true,
    config: peerConfig.CONFIG.config,
    pingInterval: 3000
  };
};