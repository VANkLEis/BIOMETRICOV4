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
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (permissions.state === 'denied') {
        throw new Error('Camera permission denied. Please enable camera access and refresh the page.');
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.mediaStream = stream;
      this.devices = (await navigator.mediaDevices.enumerateDevices())
        .filter(device => device.kind === 'videoinput');
      
      if (this.devices.length === 0) {
        throw new Error('No video devices found');
      }

      this.deviceId = this.devices[0].deviceId;
      return Promise.resolve();
    } catch (err) {
      console.error('Error initializing devices:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not access camera or microphone');
    }
  }

  async initialize(isInitiator: boolean): Promise<void> {
    try {
      if (!this.devices.length) {
        await this.initializeDevices();
      }

      if (this.peer) {
        this.peer.destroy();
      }

      const stream = await this.getLocalStream();
      
      this.peer = new SimplePeer({
        initiator: isInitiator,
        stream: stream,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
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
      // Emit signal data for the application to handle
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
        detail: { message: 'Connection error occurred. Please try again.' }
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
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const device = devices.find(d => d.deviceId === deviceId && d.kind === 'videoinput');
      
      if (!device) {
        throw new Error('Selected video device not found');
      }

      this.deviceId = deviceId;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      if (this.peer) {
        const videoTrack = this.mediaStream.getVideoTracks()[0];
        const sender = this.peer.streams[0]?.getVideoTracks()[0];
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    } catch (err) {
      console.error('Error switching device:', err);
      throw new Error('Failed to switch camera device');
    }
  }

  async getLocalStream(): Promise<MediaStream> {
    if (!this.mediaStream) {
      await this.initializeDevices();
    }
    return this.mediaStream!;
  }

  signalPeer(signal: SimplePeer.SignalData) {
    if (this.peer) {
      this.peer.signal(signal);
    }
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