import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, ChevronDown, Search } from 'lucide-react';

interface FiatSelectorProps {
  value: string;
  onChange: (fiat: string) => void;
  options: string[];
}

export const FiatSelector: React.FC<FiatSelectorProps> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="custom-network-selector" ref={dropdownRef} style={{ width: '100%', position: 'relative' }}>
      <button 
        className="network-selector-pill" 
        style={{ background: 'var(--accent)', color: 'var(--bg-secondary)', padding: '10px 20px', fontSize: '0.9rem', width: '100%', justifyContent: 'space-between' }}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign size={16} color="var(--bg-secondary)" />
          <span className="network-label" style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--bg-secondary)' }}>{value || 'USD'}</span>
        </div>
        <ChevronDown size={14} className="network-chevron" />
      </button>

      {isOpen && (
        <div className="network-dropdown-menu" style={{ width: '100%', top: 'calc(100% + 8px)', padding: '8px', zIndex: 1000, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '6px', marginBottom: '8px' }}>
            <Search size={14} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="Search currency..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
              autoFocus
            />
          </div>
          <ul className="styled-scroll" style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
            {filteredOptions.map(fiat => (
              <li 
                key={fiat}
                className={`network-dropdown-item ${fiat === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(fiat);
                  setIsOpen(false);
                  setSearch('');
                }}
                style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', borderRadius: '8px', textTransform: 'uppercase', fontSize: '0.9rem', transition: 'background 0.2s', fontWeight: 500 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {fiat}
              </li>
            ))}
            {filteredOptions.length === 0 && <li style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>No results</li>}
          </ul>
        </div>
      )}
    </div>
  );
};
