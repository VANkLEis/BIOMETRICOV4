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
      // Check both camera and microphone permissions
      const [cameraPermission, microphonePermission] = await Promise.all([
        navigator.permissions.query({ name: 'camera' as PermissionName }),
        navigator.permissions.query({ name: 'microphone' as PermissionName })
      ]);

      if (cameraPermission.state === 'denied') {
        throw new Error('Camera access is blocked. Please enable camera access in your browser settings and refresh the page.');
      }

      if (microphonePermission.state === 'denied') {
        throw new Error('Microphone access is blocked. Please enable microphone access in your browser settings and refresh the page.');
      }

      // Stop any existing streams
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      // Request media with specific constraints
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
      
      if (!stream) {
        throw new Error('Failed to get media stream. Please check your camera and microphone.');
      }

      // Verify we have both audio and video tracks
      if (!stream.getVideoTracks().length) {
        throw new Error('No video track available. Please check your camera connection.');
      }

      if (!stream.getAudioTracks().length) {
        throw new Error('No audio track available. Please check your microphone connection.');
      }

      this.mediaStream = stream;
      
      // Enumerate available devices
      this.devices = (await navigator.mediaDevices.enumerateDevices())
        .filter(device => device.kind === 'videoinput');
      
      if (this.devices.length === 0) {
        throw new Error('No video devices found. Please connect a camera and refresh the page.');
      }

      this.deviceId = this.devices[0].deviceId;
    } catch (err) {
      console.error('Error initializing devices:', err);
      if (err instanceof Error) {
        throw new Error(`Device initialization failed: ${err.message}`);
      } else {
        throw new Error('Could not access camera or microphone. Please check your device permissions.');
      }
    }
  }

  async initialize(isInitiator: boolean): Promise<void> {
    try {
      if (!this.devices.length || !this.mediaStream) {
        await this.initializeDevices();
      }

      if (!this.mediaStream) {
        throw new Error('Failed to initialize media stream');
      }

      if (this.peer) {
        this.peer.destroy();
      }

      this.peer = new SimplePeer({
        initiator: isInitiator,
        stream: this.mediaStream,
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
      const event = new CustomEvent('peerSignal', { detail: data });
      window.dispatchEvent(event);
    });

    this.peer.on('stream', stream => {
      if (!stream) {
        const event = new CustomEvent('peerError', {
          detail: { message: 'Remote stream is not available' }
        });
        window.dispatchEvent(event);
        return;
      }
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
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      if (!newStream) {
        throw new Error('Failed to get media stream from selected device');
      }

      this.mediaStream = newStream;

      if (this.peer && this.peer.streams[0]) {
        const videoTrack = this.mediaStream.getVideoTracks()[0];
        const sender = this.peer.streams[0].getVideoTracks()[0];
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      }
    } catch (err) {
      console.error('Error switching device:', err);
      throw new Error('Failed to switch camera device. Please check your permissions and try again.');
    }
  }

  async getLocalStream(): Promise<MediaStream> {
    try {
      if (!this.mediaStream) {
        await this.initializeDevices();
      }
      
      if (!this.mediaStream) {
        throw new Error('Failed to initialize media stream. Please check your camera and microphone permissions.');
      }
      
      return this.mediaStream;
    } catch (err) {
      console.error('Error getting local stream:', err);
      throw err;
    }
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