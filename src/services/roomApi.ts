import axios from 'axios';

const API_URL = import.meta.env.VITE_ROOM_API_URL || (
  window.location.hostname === 'localhost' ? 
  'https://localhost:3000' : // Changed from http to https
  'https://secure-call-cmdy.onrender.com'
);

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
      const response = await axios.post(`${API_URL}/rooms`, { hostId }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating room:', error.response || error);
      throw new Error(error.response?.data?.message || 'Failed to create room');
    }
  },

  async joinRoom(roomId: string, peerId: string): Promise<JoinRoomResponse> {
    try {
      const response = await axios.post(`${API_URL}/rooms/${roomId}/join`, 
        { peerId },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          withCredentials: true
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error joining room:', error.response || error);
      throw new Error(error.response?.data?.message || 'Failed to join room');
    }
  },

  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    try {
      const response = await axios.get(`${API_URL}/rooms/${roomId}`, {
        withCredentials: true
      });
      return response.data;
    } catch (error: any) {
      console.error('Error getting room info:', error.response || error);
      throw new Error(error.response?.data?.message || 'Room not found');
    }
  },

  async deleteRoom(roomId: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/rooms/${roomId}`, {
        withCredentials: true
      });
    } catch (error: any) {
      console.error('Error deleting room:', error.response || error);
      throw new Error(error.response?.data?.message || 'Failed to delete room');
    }
  }
};