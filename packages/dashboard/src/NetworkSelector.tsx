import React, { useState, useRef, useEffect } from 'react';
import { Network, ChevronDown } from 'lucide-react';

const NETWORKS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'bsc', label: 'BNB Smart Chain' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum One' },
  { id: 'optimism', label: 'OP Mainnet' },
  { id: 'polygon', label: 'Polygon (Matic)' },
  { id: 'sepolia', label: 'Sepolia (Testnet)' }
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
        <Network size={16} className="network-icon" />
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
            >
              {net.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
