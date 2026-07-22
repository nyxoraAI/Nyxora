import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, Save, Eye, EyeOff, Trash2 } from 'lucide-react';
import { apiFetch } from './utils/api';
import { getRouterLogoUrl } from './utils/logos';

interface ApiKeyRequirement {
  id: string;
  label: string;
  required: boolean;
  docsUrl?: string;
  configured: boolean;
}

export const DefiConfig: React.FC = () => {
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
    <div className="overview-container" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '10px' }}>
          <KeyRound size={24} color="#f59e0b" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>DeFi Config</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            API keys for DeFi aggregator providers
          </p>
        </div>
      </div>

      {/* Status toast */}
      {status && (
        <div style={{
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', fontWeight: 600
        }}>
          <CheckCircle2 size={16} />
          {status}
        </div>
      )}

      {/* Security warning */}
      <div style={{
        background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
        borderRadius: '6px', padding: '12px 16px', marginBottom: '24px',
        display: 'flex', gap: '12px', alignItems: 'flex-start'
      }}>
        <ShieldAlert size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: '#f59e0b' }}>Security Notice:</strong> Your keys are stored in plain text locally inside{' '}
          <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px' }}>~/.nyxora/config/defi_keys.yaml</code>.{' '}
          They are highly isolated and never transmitted except directly to the respective provider's API.
        </p>
      </div>

      {/* Section label */}
      <div style={{
        fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px'
      }}>
        Dynamic Provider Integrations
      </div>

      {/* Empty state */}
      {requirements.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 20px', fontSize: '0.875rem' }}>
          No API keys required by currently active providers.
        </div>
      )}

      {/* API key cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {requirements.map(req => (
          <div
            key={req.id}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            {/* Left: logo + name + badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px', flex: '0 0 auto' }}>
              <img
                src={getRouterLogoUrl(req.id)}
                alt={req.id}
                style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{req.label}</strong>
                  {req.configured && (
                    <span style={{
                      color: '#10b981', fontSize: '0.68rem', fontWeight: 700,
                      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                      padding: '2px 8px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <CheckCircle2 size={10} /> CONFIGURED
                    </span>
                  )}
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {req.required ? 'Required' : 'Optional'} API Key.
                  {req.docsUrl && (
                    <a href={req.docsUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '4px', color: 'var(--accent)' }}>
                      Get Key
                    </a>
                  )}
                </span>
              </div>
            </div>

            {/* Right: input + actions */}
            <div style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'center', minWidth: '260px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type={showKey[req.id] ? 'text' : 'password'}
                  className="nord-input"
                  style={{
                    paddingRight: '40px',
                    borderColor: req.configured ? 'rgba(16,185,129,0.4)' : 'var(--glass-border)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  placeholder={req.configured ? '••••••••••••••••' : 'Paste API Key here...'}
                  value={inputValues[req.id] || ''}
                  onChange={e => setInputValues({ ...inputValues, [req.id]: e.target.value })}
                />
                <button
                  style={{
                    position: 'absolute', right: '10px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex'
                  }}
                  onClick={() => setShowKey({ ...showKey, [req.id]: !showKey[req.id] })}
                >
                  {showKey[req.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button
                className="nord-btn-primary"
                onClick={() => handleSave(req.id)}
                disabled={!inputValues[req.id]}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0 16px', height: '40px', flexShrink: 0,
                  background: 'var(--accent)', color: 'var(--accent-text)',
                  border: 'none', borderRadius: '6px', fontWeight: 700,
                  cursor: inputValues[req.id] ? 'pointer' : 'not-allowed',
                  opacity: inputValues[req.id] ? 1 : 0.5
                }}
              >
                <Save size={15} /> Save
              </button>

              {req.configured && (
                <button
                  onClick={() => handleDelete(req.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    height: '40px', padding: '0 14px', background: 'transparent',
                    border: '1px solid var(--danger)', color: 'var(--danger)',
                    borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
                    fontSize: '0.85rem', fontWeight: 600
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DefiConfig;
