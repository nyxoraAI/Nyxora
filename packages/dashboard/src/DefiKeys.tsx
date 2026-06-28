import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, Save, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from './utils/api';
import { getRouterLogoUrl } from './utils/logos';

interface ApiKeyRequirement {
  id: string;
  label: string;
  required: boolean;
  docsUrl?: string;
  configured: boolean;
}

export const DefiKeys: React.FC = () => {
  const [requirements, setRequirements] = useState<ApiKeyRequirement[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const res = await apiFetch('/api/defi-keys');
        const data = await res.json();
        if (data.requirements) {
          setRequirements(data.requirements);
        }
      } catch (err) {
        console.error("Failed to fetch defi keys");
      }
    };
    fetchKeys();
  }, []);

  const handleSave = async (id: string) => {
    try {
      const value = inputValues[id];
      if (!value) return;

      const payload = { [id]: value };
      const res = await apiFetch('/api/defi-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setStatus(`Saved successfully!`);
        
        // Update local state to reflect configured
        setRequirements(reqs => reqs.map(r => r.id === id ? { ...r, configured: true } : r));
        setInputValues(prev => {
          const next = { ...prev };
          delete next[id]; // clear input
          return next;
        });

        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
      setStatus(`Failed to save key`);
    }
  };
  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/defi-keys/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setStatus(`Key deleted successfully!`);
        setRequirements(reqs => reqs.map(r => r.id === id ? { ...r, configured: false } : r));
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
      setStatus(`Failed to delete key`);
    }
  };

  return (
    <div className="settings-subpanel">
      <div className="nord-panel-header">
        <KeyRound size={28} color="var(--accent)" />
        <h2 className="settings-title" style={{ margin: 0, color: 'var(--text-primary)' }}>DeFi Configuration</h2>
      </div>

      <div style={{ background: 'rgba(235, 203, 139, 0.1)', border: '1px solid rgba(235, 203, 139, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <ShieldAlert size={24} color="#ebcb8b" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: '#ebcb8b' }}>Security Notice:</strong> Your keys are stored in plain text locally inside <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px' }}>~/.nyxora/config/defi_keys.yaml</code>. 
          They are highly isolated and never transmitted except directly to the respective provider's API.
        </p>
      </div>

      {status && (
        <div style={{ background: 'rgba(163, 190, 140, 0.1)', border: '1px solid rgba(163, 190, 140, 0.3)', color: '#a3be8c', padding: '14px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
          <CheckCircle2 size={20} /> <strong>{status}</strong>
        </div>
      )}

      <div className="settings-section">
        <h3 className="section-title" style={{ color: 'var(--accent)', marginBottom: '8px', fontSize: '1.2rem' }}>Dynamic Provider Integrations</h3>
        <p className="section-description" style={{ marginBottom: '32px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>These fields are dynamically loaded from installed DeFi Aggregator Providers. Provide your API keys to bypass rate limits.</p>
        
        {requirements.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
            No API Keys required by currently active providers.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {requirements.map(req => {
            return (
              <div key={req.id} style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ width: '280px', flexShrink: 0, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <img src={getRouterLogoUrl(req.id)} alt={req.id} style={{ width: 32, height: 32, borderRadius: '50%', marginTop: '2px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '1rem', display: 'block' }}>{req.label}</strong>
                      {req.configured && <span style={{ color: '#a3be8c', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, background: 'rgba(163, 190, 140, 0.1)', padding: '2px 8px', borderRadius: '9999px' }}><CheckCircle2 size={12}/> CONFIGURED</span>}
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4, display: 'block' }}>
                      {req.required ? 'Required' : 'Optional'} API Key.
                      {req.docsUrl && <a href={req.docsUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '4px', color: 'var(--accent)' }}>Get Key</a>}
                    </span>
                  </div>
                </div>
                
                <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showKey[req.id] ? "text" : "password"}
                      className="nord-input"
                      style={{ paddingRight: '40px', borderColor: req.configured ? '#a3be8c' : 'var(--glass-border)', width: '100%' }}
                      placeholder={req.configured ? "••••••••••••••••" : "Paste API Key here..."}
                      value={inputValues[req.id] || ''}
                      onChange={e => setInputValues({ ...inputValues, [req.id]: e.target.value })}
                    />
                    <button 
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--tool-bg)', cursor: 'pointer' }}
                      onClick={() => setShowKey({ ...showKey, [req.id]: !showKey[req.id] })}
                    >
                      {showKey[req.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button 
                    className="nord-btn-primary" 
                    onClick={() => handleSave(req.id)}
                    disabled={!inputValues[req.id]}
                    style={{ padding: '0 20px', height: '40px', gap: '8px', flexShrink: 0 }}
                  >
                    <Save size={16} /> Save
                  </button>
                  {req.configured && (
                    <button 
                      onClick={() => handleDelete(req.id)}
                      style={{ height: '40px', padding: '0 16px', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
                    >
                      Delete
                    </button>
                  )}
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
