import React, { useState, useEffect } from 'react';
import { Server, ShieldAlert, CheckCircle2, Save, AlertTriangle } from 'lucide-react';
import { apiFetch } from './utils/api';

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum Mainnet' },
  { id: 'base', name: 'Base Mainnet' },
  { id: 'optimism', name: 'Optimism Mainnet' },
  { id: 'arbitrum', name: 'Arbitrum One' },
  { id: 'bsc', name: 'Binance Smart Chain' },
  { id: 'polygon', name: 'Polygon Mainnet' },
  { id: 'sepolia', name: 'Sepolia (Testnet)' },
  { id: 'base_sepolia', name: 'Base Sepolia (Testnet)' },
  { id: 'optimism_sepolia', name: 'OP Sepolia (Testnet)' },
  { id: 'arbitrum_sepolia', name: 'Arbitrum Sepolia (Testnet)' }
];

export const RpcConfig: React.FC = () => {
  const [rpcUrls, setRpcUrls] = useState<Record<string, string | string[]>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchRpc = async () => {
      try {
        const res = await apiFetch('/api/rpc');
        const data = await res.json();
        setRpcUrls(data || {});
      } catch (err) {
        console.error("Failed to fetch rpc config");
      }
    };
    fetchRpc();
  }, []);

  const handleSave = async (chainId: string, value: string) => {
    try {
      const payload = { [chainId]: value };
      const res = await apiFetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatus(`Saved RPC for ${chainId} successfully!`);
        setRpcUrls({ ...rpcUrls, [chainId]: value });
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
      setStatus(`Failed to save RPC for ${chainId}`);
    }
  };

  const getDisplayValue = (val: string | string[] | undefined) => {
    if (!val) return '';
    if (Array.isArray(val)) return val[0] || '';
    return val;
  };

  return (
    <div className="overview-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="nord-panel-header">
        <Server size={28} color="#88c0d0" />
        <h2 className="settings-title" style={{ margin: 0, color: '#eceff4' }}>RPC Configuration</h2>
      </div>

      <div style={{ background: 'rgba(235, 203, 139, 0.1)', border: '1px solid rgba(235, 203, 139, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <ShieldAlert size={24} color="#ebcb8b" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.9rem', color: '#d8dee9', lineHeight: 1.6 }}>
          <strong style={{ color: '#ebcb8b' }}>Privacy & Security:</strong> Your RPC keys are saved in a highly isolated <code style={{ background: '#2e3440', padding: '2px 6px', borderRadius: '4px', color: '#88c0d0' }}>~/.nyxora/config/rpc_key.yaml</code> file. 
          This guarantees that sharing your agent's config or prompts won't accidentally leak your premium node endpoints.
        </div>
      </div>

      {status && (
        <div style={{ background: 'rgba(163, 190, 140, 0.1)', border: '1px solid rgba(163, 190, 140, 0.3)', color: '#a3be8c', padding: '14px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
          <CheckCircle2 size={20} /> <strong>{status}</strong>
        </div>
      )}

      <div className="settings-section">
        <h3 className="section-title" style={{ color: '#88c0d0', marginBottom: '8px', fontSize: '1.2rem' }}>Network Endpoints</h3>
        <p className="section-description" style={{ marginBottom: '16px', color: '#d8dee9', fontSize: '0.95rem' }}>
          Configure your private RPC URLs (Alchemy, Infura, etc.) for High-Frequency execution.
        </p>
        <div style={{ background: 'rgba(191, 97, 106, 0.1)', color: '#bf616a', padding: '10px 14px', borderRadius: '6px', marginBottom: '32px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} /> Leaving a field empty will trigger the Agent's automatic <strong>Public Fallback Mechanism</strong>.
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {SUPPORTED_CHAINS.map(chain => {
            const currentVal = getDisplayValue(rpcUrls[chain.id]);
            return (
              <div key={chain.id} style={{ background: '#2e3440', padding: '20px', borderRadius: '12px', border: '1px solid #434c5e', display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ width: '200px', flexShrink: 0 }}>
                  <strong style={{ color: '#eceff4', fontSize: '1rem', display: 'block' }}>{chain.name}</strong>
                  <span style={{ color: '#81a1c1', fontSize: '0.8rem', fontFamily: 'monospace' }}>{chain.id}</span>
                </div>
                
                <div style={{ flex: 1, display: 'flex', gap: '12px' }}>
                  <input
                    type="password"
                    className="nord-input"
                    style={{ flex: 1 }}
                    placeholder="e.g. https://base-mainnet.g.alchemy.com/v2/..."
                    value={currentVal}
                    onChange={e => setRpcUrls({ ...rpcUrls, [chain.id]: e.target.value })}
                  />
                  <button 
                    className="nord-btn-primary" 
                    onClick={() => handleSave(chain.id, currentVal)}
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

export default RpcConfig;
