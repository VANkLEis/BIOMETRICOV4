// PeerJS server configuration
export const peerConfig = {
  // PeerJS server configuration for local network
  SERVER_URL: 'localhost',
  SERVER_PORT: 443, // Changed to standard HTTPS port
  SERVER_PATH: '/peerjs',
  
  // PeerJS configuration
  CONFIG: {
    debug: 3,
    secure: true,
    host: 'localhost',
    port: 443,
    path: '/peerjs',
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  }
};

// Helper function to get full server URL
export const getPeerServerUrl = () => {
  return {
    host: peerConfig.SERVER_URL,
    port: peerConfig.SERVER_PORT,
    path: peerConfig.SERVER_PATH,
    secure: true,
    config: peerConfig.CONFIG.config
  };
};