import { io, Socket } from 'socket.io-client';

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectionListeners: ((connected: boolean, error?: string) => void)[] = [];
  
  private constructor() {}
  
  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  addConnectionListener(listener: (connected: boolean, error?: string) => void) {
    this.connectionListeners.push(listener);
  }

  removeConnectionListener(listener: (connected: boolean, error?: string) => void) {
    this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
  }

  private notifyListeners(connected: boolean, error?: string) {
    this.connectionListeners.forEach(listener => listener(connected, error));
  }

  connect(userId: string) {
    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Reset reconnect attempts
    this.reconnectAttempts = 0;

    // Connect to free Render.com deployment
    this.socket = io('https://securecall-signaling.onrender.com', {
      query: { userId },
      transports: ['websocket', 'polling'], // Allow fallback to polling if websocket fails
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('Connected to signaling server');
      this.notifyListeners(true);
      this.reconnectAttempts = 0;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        const errorMessage = 'Failed to connect to signaling server after multiple attempts. Please check your internet connection and try again.';
        console.error(errorMessage);
        this.notifyListeners(false, errorMessage);
      } else {
        this.notifyListeners(false, `Connection attempt ${this.reconnectAttempts} failed. Retrying...`);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from signaling server:', reason);
      this.notifyListeners(false, 'Disconnected from signaling server');
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to signaling server after', attemptNumber, 'attempts');
      this.notifyListeners(true);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      this.notifyListeners(false, 'Failed to reconnect to signaling server');
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to signaling server');
      this.notifyListeners(false, 'Failed to reconnect to signaling server after multiple attempts');
    });
  }

  joinRoom(roomId: string) {
    if (!this.socket?.connected) {
      console.error('Cannot join room: Not connected to signaling server');
      return;
    }
    this.socket.emit('join-room', { roomId });
  }

  onPeerJoined(callback: (peerId: string) => void) {
    if (this.socket) {
      this.socket.on('peer-joined', callback);
    }
  }

  onPeerLeft(callback: (peerId: string) => void) {
    if (this.socket) {
      this.socket.on('peer-left', callback);
    }
  }

  sendSignal(peerId: string, signal: any) {
    if (!this.socket?.connected) {
      console.error('Cannot send signal: Not connected to signaling server');
      return;
    }
    this.socket.emit('signal', { peerId, signal });
  }

  onSignal(callback: (data: { peerId: string; signal: any }) => void) {
    if (this.socket) {
      this.socket.on('signal', callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.notifyListeners(false, 'Manually disconnected from signaling server');
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export default SocketService.getInstance();