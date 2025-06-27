import React from 'react';
import { useLogo } from '../contexts/LogoContext';

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { logo } = useLogo();
  
  return (
    <div className={`flex items-center ${className}`}>
      {logo ? (
        <img src={logo} alt="Company Logo" className="h-12 w-auto" />
      ) : (
        <img 
          src="src/components/LogoPrincipal.png"
          alt="Default Logo" 
          className="h-12 w-auto" 
        />
      )}
    </div>
  );
};

export default Logo;