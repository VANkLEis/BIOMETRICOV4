import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import WebRTCService from '../services/webrtc';

interface DeviceSelectorProps {
  onDeviceSelect: (deviceId: string) => void;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ onDeviceSelect }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true);
        setError(null);
        const availableDevices = await WebRTCService.getAvailableDevices();
        setDevices(availableDevices);
        
        if (availableDevices.length > 0) {
          // Try to find DroidCam if available
          const droidcam = availableDevices.find(d => d.label.toLowerCase().includes('droidcam'));
          const deviceId = droidcam?.deviceId || availableDevices[0].deviceId;
          
          setSelectedDevice(deviceId);
          onDeviceSelect(deviceId);
        }
      } catch (err) {
        console.error('Error loading devices:', err);
        setError('Failed to load camera devices');
      } finally {
        setLoading(false);
      }
    };

    loadDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, [onDeviceSelect]);

  const handleDeviceChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value;
    try {
      setSelectedDevice(deviceId);
      await WebRTCService.setVideoDevice(deviceId);
      onDeviceSelect(deviceId);
    } catch (err) {
      console.error('Error switching device:', err);
      setError('Failed to switch camera');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-md">
        <Camera className="h-5 w-5 text-gray-400 animate-pulse" />
        <span className="text-gray-400 text-sm">Loading cameras...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 bg-red-800 bg-opacity-50 p-2 rounded-md">
        <Camera className="h-5 w-5 text-red-400" />
        <span className="text-red-400 text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-md">
      <Camera className="h-5 w-5 text-gray-400" />
      <select
        value={selectedDevice}
        onChange={handleDeviceChange}
        className="bg-gray-700 text-white text-sm rounded-md border-gray-600 focus:ring-blue-500 focus:border-blue-500"
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${devices.indexOf(device) + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DeviceSelector;