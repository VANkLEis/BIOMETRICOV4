import SimplePeer from 'simple-peer';

class WebRTCService {
  private static instance: WebRTCService;
  private peer: SimplePeer.Instance | null = null;
  private stream: MediaStream | null = null;

  private constructor() {}

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async getLocalStream(): Promise<MediaStream> {
    try {
      if (this.stream && this.stream.active) {
        return this.stream;
      }

      // Stop any existing stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Verify stream is valid
      if (!stream || !stream.active) {
        throw new Error('Failed to get active media stream');
      }

      this.stream = stream;
      return stream;
    } catch (err) {
      console.error('Error getting local stream:', err);
      throw new Error('Could not access camera or microphone. Please check permissions.');
    }
  }

  async initialize(isInitiator: boolean): Promise<void> {
    try {
      // Get local stream first
      const stream = await this.getLocalStream();
      
      if (!stream || !stream.active) {
        throw new Error('No active media stream available');
      }

      // Clean up existing peer if any
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      // Create new peer with stream
      this.peer = new SimplePeer({
        initiator: isInitiator,
        stream: stream,
        trickle: false,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ]
        }
      });

      // Set up event handlers
      this.peer.on('signal', data => {
        console.log('Generated signal data:', data);
        const event = new CustomEvent('peerSignal', { detail: data });
        window.dispatchEvent(event);
      });

      this.peer.on('connect', () => {
        console.log('Peer connection established');
        const event = new CustomEvent('peerConnected');
        window.dispatchEvent(event);
      });

      this.peer.on('stream', stream => {
        console.log('Received remote stream');
        if (!stream || !stream.active) {
          console.error('Received invalid remote stream');
          return;
        }
        const event = new CustomEvent('remoteStream', { detail: stream });
        window.dispatchEvent(event);
      });

      this.peer.on('error', err => {
        console.error('Peer error:', err);
        const event = new CustomEvent('peerError', { 
          detail: { message: 'Connection error occurred' }
        });
        window.dispatchEvent(event);
      });

      this.peer.on('close', () => {
        console.log('Peer connection closed');
        const event = new CustomEvent('peerClosed');
        window.dispatchEvent(event);
      });

    } catch (err) {
      console.error('Error initializing peer:', err);
      throw err;
    }
  }

  signalPeer(signal: SimplePeer.SignalData) {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }
    console.log('Received signal data:', signal);
    this.peer.signal(signal);
  }

  disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  isStreamActive(): boolean {
    return !!(this.stream && this.stream.active);
  }
}

export default WebRTCService.getInstance();