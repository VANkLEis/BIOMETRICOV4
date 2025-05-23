// PeerJS server configuration
export const peerConfig = {
  // PeerJS server configuration for local network
  SERVER_URL: 'localhost', // Using localhost for secure local development
  SERVER_PORT: 9000,
  SERVER_PATH: '/peerjs',
  
  // PeerJS configuration
  CONFIG: {
    debug: 3,
    secure: true, // Enable secure connections
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
  const { SERVER_URL, SERVER_PORT, SERVER_PATH } = peerConfig;
  return {
    host: SERVER_URL,
    port: SERVER_PORT,
    path: SERVER_PATH,
    secure: true // Enable secure connections
  };
};