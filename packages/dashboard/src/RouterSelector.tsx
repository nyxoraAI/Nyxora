import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getRouterLogoUrl } from './utils/logos';
import NyxoraLogo from './NyxoraLogo';

const ROUTERS = [
  { id: 'auto', label: 'Meta-Aggregator (Auto)' },
  { id: '1inch', label: '1inch' },
  { id: '0x', label: '0x API' },
  { id: 'lifi', label: 'LI.FI' },
  { id: 'relay', label: 'Relay' },
  { id: 'openocean', label: 'OpenOcean' },
  { id: 'kyberswap', label: 'KyberSwap' }
];

const RouterImage = ({ id, size = 16, color }: { id: string, size?: number, color?: string }) => {
  if (id === 'auto') {
    return <NyxoraLogo size={size} className="network-icon" color={color} />;
  }
  const url = getRouterLogoUrl(id);
  if (!url) return <NyxoraLogo size={size} className="network-icon" color={color} />;
  
  return (
    <img 
      src={url} 
      alt={id} 
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} 
      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
      className="network-icon"
    />
  );
};

interface RouterSelectorProps {
  value: string;
  onChange: (router: string) => void;
}

export const RouterSelector: React.FC<RouterSelectorProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle cases where the loaded config value isn't in our list
  const currentRouter = ROUTERS.find(r => r.id === value) || ROUTERS[0];

  return (
    <div className="custom-network-selector" ref={dropdownRef} style={{ marginLeft: '10px' }}>
      <button 
        className="network-selector-pill" 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <RouterImage id={currentRouter.id} size={16} color="var(--chat-user-text)" />
        <span className="network-label">{currentRouter.label}</span>
        <ChevronDown size={14} className="network-chevron" />
      </button>

      {isOpen && (
        <ul className="network-dropdown-menu">
          {ROUTERS.map(router => (
            <li 
              key={router.id}
              className={`network-dropdown-item ${router.id === currentRouter.id ? 'active' : ''}`}
              onClick={() => {
                onChange(router.id);
                setIsOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RouterImage id={router.id} size={14} />
                <span>{router.label}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
