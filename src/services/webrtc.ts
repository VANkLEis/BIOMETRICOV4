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
      if (this.stream) {
        return this.stream;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      this.stream = stream;
      return stream;
    } catch (err) {
      console.error('Error getting local stream:', err);
      throw new Error('Could not access camera or microphone');
    }
  }

  async initialize(isInitiator: boolean): Promise<void> {
    try {
      const stream = await this.getLocalStream();
      
      this.peer = new SimplePeer({
        initiator: isInitiator,
        stream: stream,
        trickle: false
      });

      this.peer.on('signal', data => {
        const event = new CustomEvent('peerSignal', { detail: data });
        window.dispatchEvent(event);
      });

      this.peer.on('stream', stream => {
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
    } catch (err) {
      console.error('Error initializing peer:', err);
      throw err;
    }
  }

  signalPeer(signal: SimplePeer.SignalData) {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }
    this.peer.signal(signal);
  }

  disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export default WebRTCService.getInstance();