import React, { useState, useRef, useEffect } from 'react';
import { Network, ChevronDown } from 'lucide-react';
import { getChainLogoUrl } from './utils/logos';

const NETWORKS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'bsc', label: 'BNB Smart Chain' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum One' },
  { id: 'optimism', label: 'OP Mainnet' },
  { id: 'polygon', label: 'Polygon (Matic)' },
  { id: 'sepolia', label: 'Sepolia (Testnet)' },
  { id: 'base_sepolia', label: 'Base Sepolia (Testnet)' },
  { id: 'arbitrum_sepolia', label: 'Arbitrum Sepolia' },
  { id: 'optimism_sepolia', label: 'OP Sepolia' }
];

interface NetworkSelectorProps {
  value: string;
  onChange: (network: string) => void;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({ value, onChange }) => {
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

  const currentNetwork = NETWORKS.find(n => n.id === value) || NETWORKS[0];

  return (
    <div className="custom-network-selector" ref={dropdownRef}>
      <button 
        className="network-selector-pill" 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div style={{ width: '16px', height: '16px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img 
            src={getChainLogoUrl(currentNetwork.id)} 
            alt={currentNetwork.id} 
            style={{ width: '16px', height: '16px', objectFit: 'cover', borderRadius: '50%' }} 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <span className="network-label">{currentNetwork.label}</span>
        <ChevronDown size={14} className="network-chevron" />
      </button>

      {isOpen && (
        <ul className="network-dropdown-menu">
          {NETWORKS.map(net => (
            <li 
              key={net.id}
              className={`network-dropdown-item ${net.id === value ? 'active' : ''}`}
              onClick={() => {
                onChange(net.id);
                setIsOpen(false);
              }}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <div style={{ width: '14px', height: '14px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px', flexShrink: 0 }}>
                <img 
                  src={getChainLogoUrl(net.id)} 
                  alt={net.id} 
                  style={{ width: '14px', height: '14px', objectFit: 'cover', borderRadius: '50%' }} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              {net.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
