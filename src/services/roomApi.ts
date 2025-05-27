import axios from 'axios';

const API_URL = import.meta.env.VITE_ROOM_API_URL || 'https://secure-call-cmdy.onrender.com';

interface CreateRoomResponse {
  roomId: string;
  joinLink: string;
}

interface JoinRoomResponse {
  hostId: string;
  joined: boolean;
  message: string;
}

interface RoomInfo {
  hostId: string;
  participants: string[];
  status: 'waiting' | 'active';
}

export const RoomService = {
  async createRoom(hostId: string): Promise<CreateRoomResponse> {
    try {
      const response = await axios.post(`${API_URL}/rooms`, { hostId });
      return response.data;
    } catch (error) {
      console.error('Error creating room:', error);
      throw new Error('Failed to create room');
    }
  },

  async joinRoom(roomId: string, peerId: string): Promise<JoinRoomResponse> {
    try {
      const response = await axios.post(`${API_URL}/rooms/${roomId}/join`, { peerId });
      return response.data;
    } catch (error) {
      console.error('Error joining room:', error);
      throw new Error('Failed to join room');
    }
  },

  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    try {
      const response = await axios.get(`${API_URL}/rooms/${roomId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting room info:', error);
      throw new Error('Room not found');
    }
  },

  async deleteRoom(roomId: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/rooms/${roomId}`);
    } catch (error) {
      console.error('Error deleting room:', error);
      throw new Error('Failed to delete room');
    }
  }
};