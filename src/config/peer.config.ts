// PeerJS server configuration
export const peerConfig = {
  // Local PeerJS server configuration
  SERVER_URL: 'localhost',
  SERVER_PORT: 9000,
  SERVER_PATH: '/peerjs',
  
  // Basic PeerJS configuration for local development
  CONFIG: {
    debug: 3,
    secure: false,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    }
  }
};

// Helper function to get full server URL
export const getPeerServerUrl = () => {
  const { SERVER_URL, SERVER_PORT, SERVER_PATH } = peerConfig;
  return {
    host: SERVER_URL,
    port: SERVER_PORT,
    path: SERVER_PATH,
    secure: false
  };
};