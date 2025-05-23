import { Peer, MediaConnection } from 'peerjs';
import { peerConfig, getPeerServerUrl } from '../config/peer.config';

class WebRTCService {
  private static instance: WebRTCService;
  private peer: Peer | null = null;
  private mediaStream: MediaStream | null = null;
  private currentCall: MediaConnection | null = null;
  private deviceId: string | null = null;
  private devices: MediaDeviceInfo[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: number | null = null;
  private connectionCheckInterval: number | null = null;

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

      // Monitor track states
      stream.getTracks().forEach(track => {
        track.onended = () => this.handleTrackEnded(track);
        track.onmute = () => this.handleTrackMuted(track);
        track.onunmute = () => this.handleTrackUnmuted(track);
      });
    } catch (err) {
      console.error('Error initializing devices:', err);
      throw new Error(err instanceof Error ? err.message : 'Could not access camera or microphone');
    }
  }

  private handleTrackEnded(track: MediaStreamTrack) {
    console.log(`Track ${track.kind} ended, attempting to restart...`);
    this.restartTrack(track.kind);
  }

  private handleTrackMuted(track: MediaStreamTrack) {
    console.log(`Track ${track.kind} muted, attempting to unmute...`);
    track.enabled = true;
  }

  private handleTrackUnmuted(track: MediaStreamTrack) {
    console.log(`Track ${track.kind} unmuted`);
  }

  private async restartTrack(kind: string) {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: kind === 'video' ? {
          deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        } : false,
        audio: kind === 'audio' ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      });

      if (this.mediaStream && this.currentCall?.peerConnection) {
        const newTrack = newStream.getTracks()[0];
        const sender = this.currentCall.peerConnection.getSenders()
          .find(s => s.track?.kind === kind);
        
        if (sender) {
          await sender.replaceTrack(newTrack);
          console.log(`Successfully replaced ${kind} track`);
        }

        // Update mediaStream
        const oldTrack = this.mediaStream.getTracks().find(t => t.kind === kind);
        if (oldTrack) {
          oldTrack.stop();
          this.mediaStream.removeTrack(oldTrack);
          this.mediaStream.addTrack(newTrack);
        }
      }
    } catch (err) {
      console.error(`Error restarting ${kind} track:`, err);
    }
  }

  async initialize(userId: string): Promise<void> {
    try {
      if (!this.devices.length) {
        await this.initializeDevices();
      }

      const serverConfig = getPeerServerUrl();
      this.peer = new Peer(userId, {
        ...serverConfig,
        ...peerConfig.CONFIG
      });

      return new Promise((resolve, reject) => {
        if (!this.peer) {
          reject(new Error('Failed to create peer'));
          return;
        }

        this.peer.on('open', () => {
          console.log('Connected to PeerJS server with ID:', this.peer!.id);
          this.startConnectionCheck();
          this.reconnectAttempts = 0;
          resolve();
        });

        this.peer.on('disconnected', () => {
          console.log('Disconnected from server, attempting to reconnect...');
          this.handleDisconnection();
        });

        this.peer.on('error', (err) => {
          console.error('PeerJS error:', err);
          if (err.type === 'network' || err.type === 'server-error') {
            this.handleDisconnection();
          }
          reject(err);
        });

        this.peer.on('call', async (call) => {
          try {
            const stream = await this.getLocalStream();
            call.answer(stream);
            this.handleCall(call);
          } catch (err) {
            console.error('Error answering call:', err);
            reject(err);
          }
        });
      });
    } catch (err) {
      console.error('Error in initialize:', err);
      throw err;
    }
  }

  private startConnectionCheck() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = window.setInterval(() => {
      if (this.currentCall?.peerConnection) {
        const pc = this.currentCall.peerConnection;
        pc.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'media-source' || report.type === 'track') {
              if (report.kind === 'video' || report.kind === 'audio') {
                if (report.ended || report.muted) {
                  this.restartTrack(report.kind);
                }
              }
            }
          });
        });
      }
    }, 2000);
  }

  private handleDisconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const event = new CustomEvent('peerError', {
        detail: { message: 'Connection lost. Maximum reconnection attempts reached.' }
      });
      window.dispatchEvent(event);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 5000);

    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = window.setTimeout(() => {
      if (this.peer) {
        this.peer.reconnect();
      }
    }, delay);
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
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
        });
        this.mediaStream = null;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const device = devices.find(d => d.deviceId === deviceId && d.kind === 'videoinput');
      
      if (!device) {
        throw new Error('Selected video device not found');
      }

      this.deviceId = deviceId;
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: deviceId },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          },
          audio: true
        });
      } catch (err) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: true
        });
      }

      if (this.currentCall && this.currentCall.peerConnection) {
        const videoTrack = this.mediaStream.getVideoTracks()[0];
        const sender = this.currentCall.peerConnection.getSenders()
          .find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
    } catch (err) {
      console.error('Error switching device:', err);
      throw new Error('Failed to switch camera device. Please ensure the camera is not in use by another application and try again.');
    }
  }

  async getLocalStream(): Promise<MediaStream> {
    if (!this.mediaStream) {
      const constraints: MediaStreamConstraints = {
        video: this.deviceId ? {
          deviceId: { exact: this.deviceId },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        } : true,
        audio: true
      };

      try {
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.error('Error accessing media devices:', err);
        throw new Error('Could not access camera or microphone. Please check your device permissions and ensure no other application is using the camera.');
      }
    }
    return this.mediaStream;
  }

  async makeCall(remotePeerId: string): Promise<void> {
    if (!this.peer || this.peer.disconnected) {
      throw new Error('Not connected to server. Please wait for reconnection.');
    }

    try {
      const stream = await this.getLocalStream();
      const call = this.peer.call(remotePeerId, stream);
      this.handleCall(call);
    } catch (err) {
      console.error('Error making call:', err);
      throw err;
    }
  }

  private handleCall(call: MediaConnection) {
    this.currentCall = call;

    call.on('stream', (remoteStream: MediaStream) => {
      const event = new CustomEvent('remoteStream', { detail: remoteStream });
      window.dispatchEvent(event);
    });

    call.on('close', () => {
      this.currentCall = null;
      const event = new CustomEvent('callEnded');
      window.dispatchEvent(event);
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      this.currentCall = null;
      const event = new CustomEvent('peerError', {
        detail: { message: 'Call connection error. Please try again.' }
      });
      window.dispatchEvent(event);
    });
  }

  disconnect() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.reconnectAttempts = 0;
  }

  getPeerId(): string | null {
    return this.peer?.id || null;
  }
}

export default WebRTCService.getInstance();