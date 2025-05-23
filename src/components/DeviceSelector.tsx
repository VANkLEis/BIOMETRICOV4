import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';

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
        
        // Request permission to access devices
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
        
        setDevices(videoDevices);
        
        if (videoDevices.length > 0) {
          const deviceId = videoDevices[0].deviceId;
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
    
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, [onDeviceSelect]);

  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value;
    setSelectedDevice(deviceId);
    onDeviceSelect(deviceId);
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