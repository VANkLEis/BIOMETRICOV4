import { peerConfig, getPeerServerUrl } from '../config/peer.config';

// PeerJS server configuration
export const peerConfig = {
  // PeerJS server configuration for local network
  SERVER_URL: '192.168.1.16', // Your local IP address
  SERVER_PORT: 9000,
  SERVER_PATH: '/peerjs',
  
  // PeerJS configuration
  CONFIG: {
    debug: 3,
    secure: false, // Set to false for local network
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
    secure: false // Set to false for local network
  };
};