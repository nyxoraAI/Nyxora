import React, { useState, useRef, useEffect } from 'react';
import { Route, ChevronDown } from 'lucide-react';

const ROUTERS = [
  { id: 'auto', label: 'Default (Auto-Route)' },
  { id: '1inch', label: '1inch (Aggregator)' },
  { id: 'cowswap', label: 'CowSwap (MEV-Protect)' },
  { id: 'lifi', label: 'Li.Fi' },
  { id: 'relay', label: 'Relay' },
  { id: 'uniswap_v2', label: 'Uniswap V2' },
  { id: 'uniswap_v3', label: 'Uniswap V3' },
  { id: 'pancakeswap', label: 'PancakeSwap' }
];

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
        <Route size={16} className="network-icon" />
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
              {router.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
