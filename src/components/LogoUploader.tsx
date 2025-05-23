import React, { useRef } from 'react';
import { useLogo } from '../contexts/LogoContext';
import { Upload } from 'lucide-react';

const LogoUploader: React.FC = () => {
  const { setLogo } = useLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center space-x-2 text-gray-600 hover:text-blue-600"
      >
        <Upload className="h-6 w-6" />
        <span>Upload Company Logo</span>
      </button>
      <p className="mt-2 text-sm text-gray-500">
        Recommended size: 200x50px, PNG or JPG
      </p>
    </div>
  );
};

export default LogoUploader;