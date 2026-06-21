import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface PillSelectProps {
  value: string;
  options: { id: string; label: string; icon?: React.ReactNode }[];
  onChange: (val: string) => void;
  pillColor?: string; // e.g. #88c0d0
  textColor?: string;
}

export const PillSelect: React.FC<PillSelectProps> = ({ value, options, onChange, pillColor = 'var(--accent)', textColor = '#000000' }) => {
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

  const currentOption = options.find(o => o.id === value) || options[0];

  return (
    <div className="custom-network-selector" ref={dropdownRef} style={{ width: '100%' }}>
      <button 
        className="network-selector-pill" 
        style={{ background: pillColor, color: textColor, padding: '10px 20px', fontSize: '0.9rem', width: '100%', justifyContent: 'space-between' }}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentOption?.icon && <div>{currentOption.icon}</div>}
          <span className="network-label" style={{ fontWeight: 600 }}>{currentOption?.label}</span>
        </div>
        <ChevronDown size={14} className="network-chevron" />
      </button>

      {isOpen && (
        <ul className="network-dropdown-menu" style={{ width: '100%', top: 'calc(100% + 8px)', padding: '8px', zIndex: 1000 }}>
          {options.map(opt => (
            <li 
              key={opt.id}
              className={`network-dropdown-item ${opt.id === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.id);
                setIsOpen(false);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 500 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {opt.icon && <div>{opt.icon}</div>}
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
