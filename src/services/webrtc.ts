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
      // Stop any existing streams
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      // Request permissions and get stream
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

      if (!stream) {
        throw new Error('Failed to get media stream');
      }

      this.mediaStream = stream;

      // Get available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter(device => device.kind === 'videoinput');

      if (this.devices.length === 0) {
        throw new Error('No video devices found');
      }

      this.deviceId = this.devices[0].deviceId;

      // Add track ended handlers
      stream.getTracks().forEach(track => {
        track.onended = () => {
          console.log(`Track ${track.kind} ended`);
          this.restartTrack(track.kind);
        };
      });

    } catch (err) {
      console.error('Error initializing devices:', err);
      throw new Error('Failed to access camera/microphone');
    }
  }

  private async restartTrack(kind: string) {
    try {
      const constraints = {
        video: kind === 'video' ? {
          deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false,
        audio: kind === 'audio' ? {
          echoCancellation: true,
          noiseSuppression: true
        } : false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = newStream.getTracks()[0];

      if (this.mediaStream) {
        const oldTrack = this.mediaStream.getTracks().find(t => t.kind === kind);
        if (oldTrack) {
          oldTrack.stop();
          this.mediaStream.removeTrack(oldTrack);
          this.mediaStream.addTrack(newTrack);
        }

        // Update peer connection if it exists
        if (this.peer) {
          const sender = this.peer.streams[0].getTracks().find(t => t.kind === kind);
          if (sender) {
            sender.replaceTrack(newTrack);
          }
        }
      }
    } catch (err) {
      console.error(`Error restarting ${kind} track:`, err);
    }
  }

  async initialize(isInitiator: boolean): Promise<void> {
    try {
      // Ensure we have a media stream
      if (!this.mediaStream) {
        await this.initializeDevices();
      }

      if (!this.mediaStream) {
        throw new Error('Failed to initialize media stream');
      }

      // Clean up existing peer if any
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      // Create new peer
      this.peer = new SimplePeer({
        initiator: isInitiator,
        stream: this.mediaStream,
        trickle: true,
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
      console.log('Received remote stream:', stream);
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

      if (!newStream) {
        throw new Error('Failed to get stream from new device');
      }

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
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      this.mediaStream = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export default WebRTCService.getInstance();