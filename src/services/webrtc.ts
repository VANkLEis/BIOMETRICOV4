import { Peer } from 'peerjs';
import { getPeerServerUrl } from '../config/peer.config';

class WebRTCService {
  private static instance: WebRTCService;
  private peer: Peer | null = null;
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

  private generateUniqueId(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${userId}-${timestamp}-${random}`;
  }

  async initialize(userId: string): Promise<void> {
    try {
      this.userId = userId;
      
      // Get local stream first
      await this.getLocalStream();

      // Generate a unique peer ID
      const uniqueId = this.generateUniqueId(userId);

      // Cleanup existing peer if any
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      // Initialize PeerJS connection with unique ID
      this.peer = new Peer(uniqueId, getPeerServerUrl());

      this.setupPeerEventHandlers();

    } catch (err) {
      console.error('Error initializing WebRTC service:', err);
      this.dispatchError('Failed to initialize WebRTC service');
      throw err;
    }
  }

  private setupPeerEventHandlers(): void {
    if (!this.peer) return;

    this.peer.on('open', (id) => {
      console.log('Connected to PeerJS server with ID:', id);
      this.reconnectAttempts = 0;
      
      const event = new CustomEvent('peerConnected', { detail: { id } });
      window.dispatchEvent(event);
    });

    this.peer.on('call', async (call) => {
      try {
        console.log('Receiving call from:', call.peer);
        
        if (!this.localStream) {
          await this.getLocalStream();
        }
        
        if (this.localStream) {
          call.answer(this.localStream);
          
          call.on('stream', (remoteStream) => {
            console.log('Received remote stream');
            const event = new CustomEvent('remoteStream', { detail: remoteStream });
            window.dispatchEvent(event);
          });

          call.on('error', (err) => {
            console.error('Call error:', err);
            this.dispatchError('Error during call');
          });

          call.on('close', () => {
            console.log('Call closed');
            const event = new CustomEvent('callEnded');
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

    this.peer.on('close', () => {
      console.log('PeerJS connection closed');
      this.handleDisconnection();
    });
  }

  private dispatchError(message: string): void {
    const event = new CustomEvent('peerError', { 
      detail: { message } 
    });
    window.dispatchEvent(event);
  }

  private handlePeerError(error: any): void {
    if (error.type === 'peer-unavailable') {
      this.dispatchError('The peer you are trying to connect to is not available');
    } else if (error.type === 'invalid-id') {
      this.dispatchError('Invalid peer ID');
    } else if (error.type === 'invalid-key') {
      this.dispatchError('Invalid API key');
    } else if (error.type === 'unavailable-id') {
      // Retry with a new ID
      if (this.userId) {
        this.initialize(this.userId).catch(console.error);
      }
    } else {
      this.dispatchError(error.message || 'PeerJS connection error');
    }

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
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      const jitter = Math.random() * 1000; // Add random jitter to prevent thundering herd

      this.reconnectTimeout = setTimeout(async () => {
        console.log(`Reconnection attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts}`);
        
        try {
          await this.initialize(this.userId!);
          this.reconnectTimeout = null;
        } catch (err) {
          console.error('Reconnection failed:', err);
          this.handleDisconnection();
        }
      }, backoffTime + jitter);
    }
  }

  async getLocalStream(): Promise<MediaStream> {
    try {
      if (this.localStream && this.localStream.active) {
        return this.localStream;
      }

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

      console.log('Calling peer:', peerId);
      const call = this.peer.call(peerId, this.localStream);
      
      call.on('stream', (remoteStream) => {
        console.log('Received remote stream from call');
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