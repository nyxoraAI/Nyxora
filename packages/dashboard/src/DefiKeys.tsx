import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, Save, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from './utils/api';

const DEFI_PROTOCOLS = [
  { id: 'cmc_key', name: 'CoinMarketCap', desc: 'Used for Global Market Analysis & Prices' },
  { id: 'zerion_key', name: 'Zerion', desc: 'Used for Deep Portfolio & Asset Tracking' },
  { id: 'inch_key', name: '1inch', desc: 'Used for Mainnet Meta-Aggregator Routing' },
  { id: 'zero_x_key', name: '0x', desc: 'Used for MEV-Protected Swaps' },
  { id: 'lifi_key', name: 'LI.FI', desc: 'Used for Cross-Chain Bridging' },
  { id: 'relay_key', name: 'Relay', desc: 'Used for Testnet & Mainnet Instant Routing' },
  { id: 'openocean_key', name: 'OpenOcean', desc: 'Used for High-Liquidity Deep Swaps' }
];

export const DefiKeys: React.FC = () => {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const res = await apiFetch('/api/defi-keys');
        const data = await res.json();
        // The backend should return values like "IS_SET" or "****"
        setKeys(data || {});
      } catch (err) {
        console.error("Failed to fetch defi keys");
      }
    };
    fetchKeys();
  }, []);

  const handleSave = async (id: string) => {
    try {
      const value = keys[id];
      if (!value || value === 'IS_SET') return;

      const payload = { [id]: value };
      const res = await apiFetch('/api/defi-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatus(`Saved ${id} successfully!`);
        setKeys({ ...keys, [id]: 'IS_SET' });
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
      setStatus(`Failed to save ${id}`);
    }
  };

  return (
    <div className="overview-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="nord-panel-header">
        <KeyRound size={28} color="#88c0d0" />
        <h2 className="settings-title" style={{ margin: 0, color: '#eceff4' }}>DeFi Configuration</h2>
      </div>

      <div style={{ background: 'rgba(235, 203, 139, 0.1)', border: '1px solid rgba(235, 203, 139, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <ShieldAlert size={24} color="#ebcb8b" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.9rem', color: '#d8dee9', lineHeight: 1.6 }}>
          <strong style={{ color: '#ebcb8b' }}>Security Notice:</strong> Your keys are encrypted locally by the Nyxora backend. 
          To protect against browser extensions and screen-sharing, stored keys are NEVER sent back to this dashboard. 
          They will simply appear as <code style={{ background: '#2e3440', padding: '2px 6px', borderRadius: '4px', color: '#88c0d0' }}>IS_SET</code>.
        </div>
      </div>

      {status && (
        <div style={{ background: 'rgba(163, 190, 140, 0.1)', border: '1px solid rgba(163, 190, 140, 0.3)', color: '#a3be8c', padding: '14px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
          <CheckCircle2 size={20} /> <strong>{status}</strong>
        </div>
      )}

      <div className="settings-section">
        <h3 className="section-title" style={{ color: '#88c0d0', marginBottom: '8px', fontSize: '1.2rem' }}>Protocol Integrations</h3>
        <p className="section-description" style={{ marginBottom: '32px', color: '#d8dee9', fontSize: '0.95rem' }}>Provide your own API keys to bypass public rate limits and unlock full Meta-Aggregator speed.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
          {DEFI_PROTOCOLS.map(protocol => {
            const isSet = keys[protocol.id] === 'IS_SET';
            return (
              <div key={protocol.id} style={{ background: '#2e3440', padding: '24px', borderRadius: '12px', border: '1px solid #434c5e', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ color: '#eceff4', fontSize: '1.1rem' }}>{protocol.name}</strong>
                  {isSet && <span style={{ color: '#a3be8c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, background: 'rgba(163, 190, 140, 0.1)', padding: '4px 10px', borderRadius: '9999px' }}><CheckCircle2 size={14}/> ACTIVE</span>}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#81a1c1', marginBottom: '20px' }}>{protocol.desc}</div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showKey[protocol.id] ? "text" : "password"}
                      className="nord-input"
                      style={{ paddingRight: '40px', borderColor: isSet ? '#a3be8c' : '#434c5e' }}
                      placeholder={isSet ? "••••••••••••••••" : "Paste API Key here..."}
                      value={keys[protocol.id] === 'IS_SET' ? '' : (keys[protocol.id] || '')}
                      onChange={e => setKeys({ ...keys, [protocol.id]: e.target.value })}
                      disabled={isSet && keys[protocol.id] === 'IS_SET'}
                    />
                    {!isSet && (
                      <button 
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4c566a', cursor: 'pointer' }}
                        onClick={() => setShowKey({ ...showKey, [protocol.id]: !showKey[protocol.id] })}
                      >
                        {showKey[protocol.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                  <button 
                    className="nord-btn-primary" 
                    onClick={() => handleSave(protocol.id)}
                    disabled={!keys[protocol.id] || keys[protocol.id] === 'IS_SET'}
                    style={{ padding: '0 20px', height: '40px', gap: '8px' }}
                  >
                    <Save size={16} /> Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DefiKeys;
