
import React, { useEffect, useState } from 'react';
import { getSettings } from '../services/storageService';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const [customLogo, setCustomLogo] = useState<string | undefined>(undefined);
  const [imgError, setImgError] = useState(false);
  
  const loadLogo = async () => {
    const settings = await getSettings();
    setCustomLogo(settings.logo);
    setImgError(false);
  };

  useEffect(() => {
    loadLogo();

    const handleUpdate = () => {
      loadLogo();
    };

    window.addEventListener('settings-updated', handleUpdate);
    return () => window.removeEventListener('settings-updated', handleUpdate);
  }, []);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-32 h-32',
    xl: 'w-52 h-52'
  };

  const logoSrc = customLogo || 'logo.png';

  if (!imgError) {
    return (
      <div className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden ${className}`}>
        <img 
          src={logoSrc} 
          key={logoSrc}
          alt="Assembleia de Deus Geração Unida" 
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} relative flex items-center justify-center bg-transparent ${className}`}>
      <svg viewBox="0 0 400 400" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <path id="textCurve" d="M 60,200 A 140,140 0 0,1 340,200" />
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="200" cy="200" r="105" fill="#2D7FF9" />
        <path d="M150 140c10 5 30 0 40 20s-10 40 10 50 30-10 40 10" stroke="#4ADE80" strokeWidth="25" strokeLinecap="round" opacity="0.7" />
        <path d="M220 250c-20 5-40 20-30 40s30 10 20 30" stroke="#4ADE80" strokeWidth="15" strokeLinecap="round" opacity="0.6" />
        <g filter="url(#shadow)">
          <path d="M110 280c5-10 15-30 40-30s35 20 40 30" stroke="#C68642" strokeWidth="12" strokeLinecap="round" />
          <path d="M290 280c-5-10-15-30-40-30s-35 20-40 30" stroke="#8D5524" strokeWidth="12" strokeLinecap="round" />
          <path d="M150 310c5-12 15-35 40-35s35 20 40 35" stroke="#E0AC69" strokeWidth="10" strokeLinecap="round" />
          <path d="M250 310c-5-12-15-35-40-35s-35 20-40 35" stroke="#F1C27D" strokeWidth="10" strokeLinecap="round" />
        </g>
        <text style={{ fontSize: '36px', fontWeight: 900, fill: '#E11D48', letterSpacing: '1px' }}>
          <textPath href="#textCurve" startOffset="50%" textAnchor="middle">
            ASSEMBLEIA DE DEUS
          </textPath>
        </text>
        <text x="200" y="380" textAnchor="middle" style={{ fontSize: '44px', fontWeight: 900, fill: '#E11D48' }}>
          GERAÇÃO UNIDA
        </text>
      </svg>
    </div>
  );
};
