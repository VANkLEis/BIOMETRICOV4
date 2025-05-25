import SimplePeer from 'simple-peer';
import { getPeerServerUrl } from '../config/peer.config';
import Peer from 'peerjs';

class WebRTCService {
  private static instance: WebRTCService;
  private peer: Peer | null = null;
  private connections: Map<string, SimplePeer.Instance> = new Map();
  private localStream: MediaStream | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private userId: string | null = null;

  private constructor() {}

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async initialize(userId: string): Promise<void> {
    try {
      this.userId = userId;
      
      // Get local stream first
      await this.getLocalStream();

      // Initialize PeerJS connection
      this.peer = new Peer(userId, getPeerServerUrl());

      this.peer.on('open', (id) => {
        console.log('Connected to PeerJS server with ID:', id);
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
        
        // Dispatch connection success event
        const event = new CustomEvent('peerConnected', { detail: { id } });
        window.dispatchEvent(event);
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
          this.dispatchError('Failed to handle incoming call');
        }
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        this.handlePeerError(err);
      });

      this.peer.on('disconnected', () => {
        console.log('Disconnected from PeerJS server, attempting to reconnect...');
        this.handleDisconnection();
      });

      // Add connection closed handler
      this.peer.on('close', () => {
        console.log('PeerJS connection closed');
        this.handleDisconnection();
      });

    } catch (err) {
      console.error('Error initializing WebRTC service:', err);
      this.dispatchError('Failed to initialize WebRTC service');
      throw err;
    }
  }

  private dispatchError(message: string): void {
    const event = new CustomEvent('peerError', { 
      detail: { message } 
    });
    window.dispatchEvent(event);
  }

  private handlePeerError(error: any): void {
    // Dispatch error event
    this.dispatchError(error.message || 'PeerJS connection error');

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    this.handleDisconnection();
  }

  private handleDisconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.dispatchError('Unable to reconnect to server after multiple attempts');
      return;
    }

    if (!this.reconnectTimeout && this.userId) {
      this.reconnectAttempts++;
      
      // Clear existing timeout if any
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      this.reconnectTimeout = setTimeout(async () => {
        console.log(`Reconnection attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts}`);
        
        try {
          await this.initialize(this.userId!);
          this.reconnectTimeout = null;
        } catch (err) {
          console.error('Reconnection failed:', err);
          // If reconnection fails, try again with exponential backoff
          const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          this.reconnectTimeout = setTimeout(() => this.handleDisconnection(), backoffTime);
        }
      }, 5000);
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
      this.dispatchError('Could not access camera or microphone. Please check permissions.');
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
        this.dispatchError('Call connection error occurred');
      });

      call.on('close', () => {
        console.log('Call ended');
        const event = new CustomEvent('callEnded');
        window.dispatchEvent(event);
      });

    } catch (err) {
      console.error('Error calling peer:', err);
      this.dispatchError('Failed to establish call connection');
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

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.reconnectAttempts = 0;
    this.userId = null;
  }

  isConnected(): boolean {
    return !!(this.peer && !this.peer.disconnected);
  }

  getCurrentPeerId(): string | null {
    return this.peer?.id || null;
  }
}

export default WebRTCService.getInstance();