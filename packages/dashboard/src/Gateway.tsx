import React, { useState, useEffect } from 'react';
import { Server, Activity, Network, ShieldAlert } from 'lucide-react';
import { apiFetch } from './utils/api';
import { usePolling } from './utils/usePolling';

export const Gateway: React.FC = () => {
  const [pingData, setPingData] = useState<{ nodejs?: { online: boolean, ping: number }, python?: { online: boolean, ping: number } }>({});
  const [firewall, setFirewall] = useState<Record<string, boolean>>({});
  
  // List of protected routes to manage in Firewall
  const criticalRoutes = [
    { path: '/api/wallet', name: 'Wallet & Transactions API' },
    { path: '/api/memory', name: 'Episodic Memory RAG API' },
    { path: '/api/playbooks', name: 'Playbook Execution API' },
    { path: '/api/skills', name: 'Agent Skills Management API' },
    { path: '/api/policy', name: 'Security Policy API' }
  ];

  const fetchPing = async () => {
    try {
      const res = await apiFetch('/api/gateway/ping');
      if (res.ok) setPingData(await res.json());
    } catch (e) {
      // ignore
    }
  };

  const fetchFirewall = async () => {
    try {
      const res = await apiFetch('/api/gateway/firewall');
      if (res.ok) setFirewall(await res.json());
    } catch (e) {
      // ignore
    }
  };

  // Poll ping every 2 seconds
  usePolling(fetchPing, 2000);
  
  // Fetch firewall once on load
  useEffect(() => {
    fetchFirewall();
  }, []);

  const handleToggleFirewall = async (path: string) => {
    // Current status (if not explicitly false in firewall config, it's considered true/active)
    const currentActive = firewall[path] !== false;
    const newActive = !currentActive;
    
    // Optimistic UI update
    setFirewall(prev => ({ ...prev, [path]: newActive }));
    
    try {
      await apiFetch('/api/gateway/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...firewall, [path]: newActive })
      });
    } catch (e) {
      // Revert on failure
      setFirewall(prev => ({ ...prev, [path]: currentActive }));
    }
  };

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px' }}>
          <Network size={24} color="#10b981" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Gateway</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Manage core gateway server connectivity and API firewall rules.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Ping Monitor */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Activity size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Live Network Latency</h3>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Node.js Gateway Node */}
            <div style={{ flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={18} color="var(--text-primary)" />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Node.js Gateway</span>
                </div>
                {pingData.nodejs?.online ? (
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>ONLINE</span>
                ) : (
                  <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>OFFLINE</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: pingData.nodejs?.online ? '#10b981' : 'var(--text-secondary)' }}>
                  {pingData.nodejs?.online ? pingData.nodejs.ping : '--'}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ms</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>Port 3000 • Core Router</div>
            </div>

            {/* Python ML Engine Node */}
            <div style={{ flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BrainIcon />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Python ML Engine</span>
                </div>
                {pingData.python?.online ? (
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>ONLINE</span>
                ) : (
                  <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>OFFLINE</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: pingData.python?.online ? '#10b981' : 'var(--text-secondary)' }}>
                  {pingData.python?.online ? pingData.python.ping : '--'}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ms</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>Port 8000 • Machine Learning</div>
            </div>
          </div>
        </div>
        
        {/* API Firewall */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <ShieldAlert size={20} color="#f59e0b" />
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>API Firewall</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
            Selectively disable core agent APIs. Disabled routes will return a 403 Forbidden status, instantly cutting off the agent's access to those modules.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {criticalRoutes.map((route, i) => {
              const active = firewall[route.path] !== false;
              return (
                <div key={i} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  background: 'var(--bg-primary)', padding: '16px 20px', 
                  borderRadius: '8px', border: '1px solid var(--glass-border)',
                  opacity: active ? 1 : 0.6
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.95rem' }}>{route.name}</h4>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{route.path}</div>
                  </div>
                  
                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggleFirewall(route.path)}
                    style={{
                      position: 'relative', width: '40px', height: '22px',
                      borderRadius: '11px', background: active ? 'var(--accent)' : 'var(--glass-border)',
                      border: 'none', cursor: 'pointer', transition: 'background 0.3s ease', padding: 0
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '2px',
                      left: active ? '20px' : '2px', width: '18px', height: '18px',
                      borderRadius: '50%', background: '#fff',
                      transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

// Helper icon component since lucide-react Brain isn't imported at top
const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
  </svg>
);

export default Gateway;
