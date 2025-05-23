import { Peer } from 'peerjs';
import { peerConfig, getPeerServerUrl } from '../config/peer.config';

class PeerService {
  private static instance: PeerService;
  private peer: Peer | null = null;
  
  private constructor() {}
  
  static getInstance(): PeerService {
    if (!PeerService.instance) {
      PeerService.instance = new PeerService();
    }
    return PeerService.instance;
  }

  connect(userId: string): Promise<Peer> {
    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(userId, {
          ...getPeerServerUrl(),
          ...peerConfig.CONFIG
        });

        this.peer.on('open', () => {
          console.log('Connected to PeerJS server');
          resolve(this.peer!);
        });

        this.peer.on('error', (error) => {
          console.error('PeerJS error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('Failed to create Peer instance:', error);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  getPeer(): Peer | null {
    return this.peer;
  }
}

export default PeerService.getInstance();