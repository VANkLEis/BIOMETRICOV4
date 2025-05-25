import SimplePeer from 'simple-peer';
import { getPeerServerUrl } from '../config/peer.config';
import Peer from 'peerjs';

class WebRTCService {
  private static instance: WebRTCService;
  private peer: Peer | null = null;
  private connections: Map<string, SimplePeer.Instance> = new Map();
  private localStream: MediaStream | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async initialize(userId: string): Promise<void> {
    try {
      // Get local stream first
      await this.getLocalStream();

      // Initialize PeerJS connection
      this.peer = new Peer(userId, getPeerServerUrl());

      this.peer.on('open', (id) => {
        console.log('Connected to PeerJS server with ID:', id);
      });

      this.peer.on('call', async (call) => {
        try {
          if (!this.localStream) {
            await this.getLocalStream();
          }
          
          if (this.localStream) {
            call.answer(this.localStream);
            
            call.on('stream', (remoteStream) => {
              const event = new CustomEvent('remoteStream', { detail: remoteStream });
              window.dispatchEvent(event);
            });
          }
        } catch (err) {
          console.error('Error handling incoming call:', err);
        }
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        this.handlePeerError();
      });

      this.peer.on('disconnected', () => {
        console.log('Disconnected from PeerJS server, attempting to reconnect...');
        this.handleDisconnection();
      });

    } catch (err) {
      console.error('Error initializing WebRTC service:', err);
      throw err;
    }
  }

  private handlePeerError(): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    // Attempt to reconnect after a delay
    if (!this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(() => {
        this.initialize(this.peer?.id || `user-${Date.now()}`);
        this.reconnectTimeout = null;
      }, 5000);
    }
  }

  private handleDisconnection(): void {
    if (this.peer) {
      this.peer.reconnect();
    }
  }

  async getLocalStream(): Promise<MediaStream> {
    try {
      if (this.localStream && this.localStream.active) {
        return this.localStream;
      }

      // Stop any existing stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.localStream = stream;
      return stream;
    } catch (err) {
      console.error('Error getting local stream:', err);
      throw new Error('Could not access camera or microphone. Please check permissions.');
    }
  }

  async callPeer(peerId: string): Promise<void> {
    try {
      if (!this.peer || !this.localStream) {
        throw new Error('Service not properly initialized');
      }

      const call = this.peer.call(peerId, this.localStream);
      
      call.on('stream', (remoteStream) => {
        const event = new CustomEvent('remoteStream', { detail: remoteStream });
        window.dispatchEvent(event);
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        const event = new CustomEvent('callError', { 
          detail: { message: 'Call connection error occurred' }
        });
        window.dispatchEvent(event);
      });

      call.on('close', () => {
        console.log('Call ended');
        const event = new CustomEvent('callEnded');
        window.dispatchEvent(event);
      });

    } catch (err) {
      console.error('Error calling peer:', err);
      throw err;
    }
  }

  disconnect(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.connections.forEach(connection => connection.destroy());
    this.connections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  isConnected(): boolean {
    return !!(this.peer && !this.peer.disconnected);
  }

  getCurrentPeerId(): string | null {
    return this.peer?.id || null;
  }
}

export default WebRTCService.getInstance();