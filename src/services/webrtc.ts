import SimplePeer from 'simple-peer';

class WebRTCService {
  private static instance: WebRTCService;
  private peer: SimplePeer.Instance | null = null;
  private mediaStream: MediaStream | null = null;
  private deviceId: string | null = null;
  private devices: MediaDeviceInfo[] = [];

  private constructor() {}

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async initializeDevices(): Promise<void> {
    try {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      this.mediaStream = stream;
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter(device => device.kind === 'videoinput');

      if (this.devices.length === 0) {
        throw new Error('No video devices found');
      }

      this.deviceId = this.devices[0].deviceId;
    } catch (err) {
      console.error('Error initializing devices:', err);
      throw new Error('Failed to access camera/microphone');
    }
  }

  async initialize(isInitiator: boolean): Promise<void> {
    try {
      if (!this.mediaStream) {
        await this.initializeDevices();
      }

      if (!this.mediaStream) {
        throw new Error('Failed to initialize media stream');
      }

      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      this.peer = new SimplePeer({
        initiator: isInitiator,
        stream: this.mediaStream,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
          ]
        }
      });

      this.setupPeerEvents();
    } catch (err) {
      console.error('Error in initialize:', err);
      throw err;
    }
  }

  private setupPeerEvents() {
    if (!this.peer) return;

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

    this.peer.on('close', () => {
      const event = new CustomEvent('callEnded');
      window.dispatchEvent(event);
    });
  }

  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    if (!this.devices.length) {
      await this.initializeDevices();
    }
    return this.devices;
  }

  async setVideoDevice(deviceId: string): Promise<void> {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      if (this.mediaStream) {
        const oldVideoTrack = this.mediaStream.getVideoTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          this.mediaStream.removeTrack(oldVideoTrack);
        }
        
        if (newVideoTrack) {
          this.mediaStream.addTrack(newVideoTrack);
        }

        if (this.peer) {
          const senders = this.peer.streams[0].getVideoTracks();
          if (senders.length > 0 && newVideoTrack) {
            senders[0].replaceTrack(newVideoTrack);
          }
        }
      } else {
        this.mediaStream = newStream;
      }

      this.deviceId = deviceId;
    } catch (err) {
      console.error('Error switching device:', err);
      throw new Error('Failed to switch camera device');
    }
  }

  async getLocalStream(): Promise<MediaStream> {
    if (!this.mediaStream) {
      await this.initializeDevices();
    }
    
    if (!this.mediaStream) {
      throw new Error('Failed to get local stream');
    }
    
    return this.mediaStream;
  }

  signalPeer(signal: SimplePeer.SignalData) {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }
    this.peer.signal(signal);
  }

  disconnect() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export default WebRTCService.getInstance();