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
    pingInterval: 5000,
    retryTimer: 5000,
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
  
  // Use environment variables if available, otherwise fall back to config
  const host = import.meta.env.VITE_PEER_HOST || peerConfig.SERVER_URL;
  const port = parseInt(import.meta.env.VITE_PEER_PORT as string) || peerConfig.SERVER_PORT;
  const path = import.meta.env.VITE_PEER_PATH || peerConfig.SERVER_PATH;
  const secure = import.meta.env.VITE_PEER_SECURE === 'true' || true;

  // Always use HTTPS in production
  if (!isLocalhost) {
    return {
      host: 'secure-call-cmdy.onrender.com',
      port: 443,
      path: '/peerjs',
      secure: true,
      config: peerConfig.CONFIG.config,
      debug: 3,
      pingInterval: 5000,
      retryTimer: 5000
    };
  }

  return {
    host,
    port,
    path,
    secure,
    config: peerConfig.CONFIG.config,
    debug: 3,
    pingInterval: 5000,
    retryTimer: 5000
  };
};