// PeerJS server configuration
export const peerConfig = {
  // PeerJS server configuration for WebContainer environment
  SERVER_URL: '0.peerjs.com', // Using PeerJS public server as fallback
  SERVER_PORT: 443, // HTTPS port
  SERVER_PATH: '/', // Root path for public server
  
  // PeerJS configuration with secure connection
  CONFIG: {
    debug: 3,
    secure: true,
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
    secure: true // Enable secure connection
  };
};