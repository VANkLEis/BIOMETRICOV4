import React from 'react';
import { useLogo } from '../contexts/LogoContext';

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { logo } = useLogo();
  const uscisLogo = '/home/santiago/Descargas/project-bolt-github-1wam1vwm/project/WhatsApp Image 2025-05-22 at 8.17.29 AM(1).png';

  return (
    <div className={`flex items-center ${className}`}>
      <img src={uscisLogo} alt="USCIS Logo" className="h-12 w-auto" />
    </div>
  );
};

export default Logo;