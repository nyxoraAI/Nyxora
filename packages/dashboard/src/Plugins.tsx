import React, { useState, useEffect } from 'react';
import { Key, Plug } from 'lucide-react';
import { apiFetch } from './utils/api';
import ExternalSkills from './ExternalSkills';

export const Plugins: React.FC = () => {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [authUrlInput, setAuthUrlInput] = useState('');
  
  useEffect(() => {
    apiFetch('/api/auth/google/status')
      .then(res => res.json())
      .then(data => { if (data) setGoogleConnected(data.connected); })
      .catch(() => {});
  }, []);

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
          <Plug size={24} color="var(--accent)" />
          Plugins & Integrations
        </h2>
      </div>

      <div className="nord-panel" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
        <div className="nord-panel-header" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Google Workspace</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Allow Nyxora to securely manage emails, calendar, docs, and drive locally.
        </p>
        
        <div style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '16px', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Google Account</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status: {googleConnected ? 'Connected' : 'Disconnected'}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {googleConnected ? (
                <button
                  onClick={async () => {
                    try {
                      const res = await apiFetch('/api/auth/google', { method: 'DELETE' });
                      if (res.ok) setGoogleConnected(false);
                    } catch {
                      alert('Failed to disconnect.');
                    }
                  }}
                  style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Disconnect
                </button>
              ) : (
                <button 
                  onClick={async () => {
                    try {
                      const res = await apiFetch('/api/auth/google/url');
                      const data = await res.json();
                      if (res.ok) {
                        window.open(data.url, '_blank', 'width=600,height=700');
                      } else {
                        alert('Setup Required: Please upload Client Secret first.');
                      }
                    } catch {
                      alert('Failed to initiate Google Auth.');
                    }
                  }}
                  style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Key size={14} /> Sign in with Google
                </button>
              )}
            </div>
          </div>

          {!googleConnected && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--glass-border)' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Used a <strong>Desktop App</strong> credential and got a "Connection Refused" error? Paste the broken URL here:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="http://localhost/?state=..."
                  value={authUrlInput}
                  onChange={(e) => setAuthUrlInput(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '4px' }}
                />
                <button 
                  disabled={!authUrlInput.trim()}
                  onClick={async () => {
                    try {
                      const res = await apiFetch('/api/auth/google/submit-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: authUrlInput.trim() })
                      });
                      if (res.ok) {
                        setGoogleConnected(true);
                        setAuthUrlInput('');
                      } else {
                        const err = await res.json();
                        alert('Verification failed: ' + err.error);
                      }
                    } catch {
                      alert('Network error.');
                    }
                  }}
                  style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '4px', cursor: authUrlInput.trim() ? 'pointer' : 'not-allowed' }}
                >
                  Verify
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="nord-panel" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}>
        <ExternalSkills />
      </div>
    </div>
  );
};

export default Plugins;
