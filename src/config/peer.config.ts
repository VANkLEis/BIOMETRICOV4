// PeerJS server configuration
export const peerConfig = {
  // Local PeerJS server configuration
  SERVER_URL: 'localhost',
  SERVER_PORT: 9000,
  SERVER_PATH: '/peerjs',
  
  // Enhanced PeerJS configuration options
  CONFIG: {
    debug: 3,
    secure: false,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      // Add connection stability improvements
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    },
    // Improved connection stability settings
    pingInterval: 1000,
    retryTimes: 3,
    reconnectTimer: 1000
  }
};

// Helper function to get full server URL
export const getPeerServerUrl = () => {
  const { SERVER_URL, SERVER_PORT, SERVER_PATH } = peerConfig;
  return {
    host: SERVER_URL,
    port: SERVER_PORT,
    path: SERVER_PATH
  };
};