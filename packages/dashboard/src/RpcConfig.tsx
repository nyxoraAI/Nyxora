import React, { useState, useEffect } from 'react';
import { Cpu, ShieldAlert, CheckCircle, Save, AlertTriangle } from 'lucide-react';
import { apiFetch } from './utils/api';
import { getChainLogoUrl } from './utils/logos';

const SUPPORTED_CHAINS = [
  { id: 'ethereum',          name: 'Ethereum Mainnet',      group: 'mainnet' },
  { id: 'base',              name: 'Base Mainnet',           group: 'mainnet' },
  { id: 'optimism',          name: 'Optimism Mainnet',       group: 'mainnet' },
  { id: 'arbitrum',          name: 'Arbitrum One',           group: 'mainnet' },
  { id: 'bsc',               name: 'Binance Smart Chain',    group: 'mainnet' },
  { id: 'polygon',           name: 'Polygon Mainnet',        group: 'mainnet' },
  { id: 'robinhood',         name: 'Robinhood Chain',        group: 'mainnet' },
  { id: 'sepolia',           name: 'Sepolia',                group: 'testnet' },
  { id: 'base_sepolia',      name: 'Base Sepolia',           group: 'testnet' },
  { id: 'optimism_sepolia',  name: 'OP Sepolia',             group: 'testnet' },
  { id: 'arbitrum_sepolia',  name: 'Arbitrum Sepolia',       group: 'testnet' },
  { id: 'robinhood_testnet', name: 'Robinhood Testnet',      group: 'testnet' },
];

const inputStyle: React.CSSProperties = {
  flex: 1, background: 'transparent', border: '1px solid var(--glass-border)',
  color: 'var(--text-primary)', padding: '9px 12px', borderRadius: '6px',
  fontFamily: 'monospace', fontSize: '0.82rem', outline: 'none', minWidth: 0,
};

const RpcConfig: React.FC = () => {
  const [rpcUrls, setRpcUrls] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    apiFetch('/api/rpc').then(r => r.json()).then(setRpcUrls).catch(() => {});
  }, []);

  const getVal = (v: string | string[] | undefined) => {
    if (!v) return '';
    return Array.isArray(v) ? v[0] || '' : v;
  };

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (chainId: string) => {
    const value = getVal(rpcUrls[chainId]);
    setSaving(chainId);
    try {
      const res = await apiFetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [chainId]: value }),
      });
      if (res.ok) showToast('ok', `Saved RPC for ${chainId}`);
      else        showToast('err', `Failed to save ${chainId}`);
    } catch {
      showToast('err', 'Connection error');
    } finally {
      setSaving(null);
    }
  };

  const mainnets = SUPPORTED_CHAINS.filter(c => c.group === 'mainnet');
  const testnets = SUPPORTED_CHAINS.filter(c => c.group === 'testnet');

  const ChainRow: React.FC<{ chain: typeof SUPPORTED_CHAINS[0] }> = ({ chain }) => {
    const val = getVal(rpcUrls[chain.id]);
    const isConfigured = !!val;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        background: 'var(--bg-secondary)', border: `1px solid ${isConfigured ? 'rgba(16,185,129,0.3)' : 'var(--glass-border)'}`,
        borderRadius: '8px', padding: '14px 16px',
      }}>
        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '200px', flexShrink: 0 }}>
          <img src={getChainLogoUrl(chain.id)} alt={chain.id} width={28} height={28}
            style={{ borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>{chain.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontFamily: 'monospace' }}>{chain.id}</div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ width: '100px', flexShrink: 0 }}>
          {isConfigured
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', padding: '2px 8px', borderRadius: '999px' }}><CheckCircle size={10} /> SET</span>
            : <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>public RPC</span>
          }
        </div>

        {/* Input + save */}
        <input
          type="password"
          style={inputStyle}
          placeholder="https://…alchemy.com/v2/YOUR_KEY"
          value={val}
          onChange={e => setRpcUrls(p => ({ ...p, [chain.id]: e.target.value }))}
        />
        <button
          onClick={() => handleSave(chain.id)}
          disabled={saving === chain.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            background: 'var(--accent)', color: 'var(--accent-text)',
            border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem',
            cursor: saving === chain.id ? 'not-allowed' : 'pointer', flexShrink: 0,
            opacity: saving === chain.id ? 0.7 : 1,
          }}
        >
          <Save size={14} /> Save
        </button>
      </div>
    );
  };

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: '8px', padding: '10px' }}>
          <Cpu size={24} color="var(--accent)" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>RPC Configuration</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Private node endpoints for each supported chain</p>
        </div>
      </div>

      {/* Warning */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
        <ShieldAlert size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6 }}>
          Keys are stored in <code style={{ color: 'var(--accent)' }}>~/.nyxora/config/rpc_key.yaml</code>. Leaving a field empty enables the <strong style={{ color: 'var(--text-primary)' }}>public fallback</strong>.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: toast.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${toast.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', color: toast.type === 'ok' ? '#10b981' : '#ef4444' }}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Mainnet section */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '8px' }}>MAINNET</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {mainnets.map(c => <ChainRow key={c.id} chain={c} />)}
      </div>

      {/* Testnet section */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '8px' }}>TESTNET</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {testnets.map(c => <ChainRow key={c.id} chain={c} />)}
      </div>
    </div>
  );
};

export default RpcConfig;
