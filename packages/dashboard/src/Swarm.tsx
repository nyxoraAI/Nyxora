import React, { useState, useEffect } from 'react';
import { Network, Activity, ShieldAlert, Cpu, Share2, Server } from 'lucide-react';
import { apiFetch } from './utils/api';
import { PillSelect } from './components/PillSelect';
import { LlmIcon } from './components/LlmIcons';

interface PeerNode {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected';
  latency: number;
  lastSeen: number;
}

export const Swarm: React.FC = () => {
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [sharedMemory, setSharedMemory] = useState<Record<string, boolean>>({});
  const [selectedModels, setSelectedModels] = useState<Record<string, { provider: string, model: string }>>({});

  const fetchPeers = async () => {
    try {
      const res = await apiFetch('/api/swarm/peers');
      if (res.ok) {
        const data = await res.json();
        setPeers(data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchPeers();
  }, []);

  const toggleShare = (id: string) => {
    setSharedMemory(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleModelChange = (id: string, field: 'provider' | 'model', value: string) => {
    setSelectedModels(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { provider: 'default', model: '' }),
        [field]: value
      }
    }));
  };

  const getStatusColor = (status: string) => {
    return status === 'connected' ? '#10b981' : '#ef4444';
  };

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '10px' }}>
            <Network size={24} color="#3b82f6" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Multi-Agent Swarm</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Manage peer-to-peer agent connections and knowledge sharing.
            </p>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Swarm Network Active</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '4fr 1fr', gap: '24px' }}>
        
        {/* Peer Network Table */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--text-secondary)" />
              Discovered Peers
            </h3>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>NODE IDENTITY</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>ROLE</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>LATENCY</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>LLM PROVIDER</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>MODEL NAME</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>MEMORY SHARE</th>
              </tr>
            </thead>
            <tbody>
              {peers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Scanning network for active agent nodes...
                  </td>
                </tr>
              ) : (
                peers.map(peer => {
                  const isShared = sharedMemory[peer.id] || false;
                  const currentProvider = selectedModels[peer.id]?.provider || 'default';
                  const currentModelName = selectedModels[peer.id]?.model || '';
                  return (
                    <tr key={peer.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                            <Cpu size={16} color="var(--accent)" />
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{peer.name}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{peer.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {peer.type}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          background: peer.status === 'connected' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: getStatusColor(peer.status),
                          padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                          border: `1px solid ${peer.status === 'connected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {peer.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: peer.status === 'connected' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          <Activity size={14} color={getStatusColor(peer.status)} />
                          <span style={{ fontSize: '0.85rem' }}>{peer.status === 'connected' ? `${peer.latency}ms` : '--'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ opacity: peer.status === 'disconnected' ? 0.6 : 1, minWidth: '190px', whiteSpace: 'nowrap' }}>
                          <PillSelect 
                            value={currentProvider}
                            onChange={(val) => handleModelChange(peer.id, 'provider', val)}
                            pillColor="transparent"
                            textColor="var(--text-primary)"
                            options={[
                              { id: 'default', label: 'Default (Global)', icon: <Cpu size={14} /> },
                              { id: 'gemini', label: 'Google Gemini', icon: <LlmIcon provider="gemini" size={14} /> },
                              { id: 'anthropic', label: 'Anthropic (Claude)', icon: <LlmIcon provider="anthropic" size={14} /> },
                              { id: 'openai', label: 'OpenAI', icon: <LlmIcon provider="openai" size={14} /> },
                              { id: 'openrouter', label: 'OpenRouter', icon: <LlmIcon provider="openrouter" size={14} /> },
                              { id: '9router', label: '9Router (Local Proxy)', icon: <LlmIcon provider="9router" size={14} /> },
                              { id: 'ollama', label: 'Ollama (Local)', icon: <LlmIcon provider="ollama" size={14} /> },
                              { id: 'groq', label: 'Groq', icon: <LlmIcon provider="groq" size={14} /> },
                              { id: 'mistral', label: 'Mistral AI', icon: <LlmIcon provider="mistral" size={14} /> },
                              { id: 'xai', label: 'xAI (Grok)', icon: <LlmIcon provider="xai" size={14} /> },
                              { id: 'deepseek', label: 'DeepSeek', icon: <LlmIcon provider="deepseek" size={14} /> },
                              { id: 'custom_provider', label: 'Custom Provider', icon: <LlmIcon provider="custom_provider" size={14} /> }
                            ]}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <input 
                          className="nord-pill-input"
                          style={{ 
                            width: '100%', padding: '8px 12px', background: 'transparent', 
                            border: '1px solid var(--glass-border)', color: 'var(--text-primary)',
                            borderRadius: '6px', fontSize: '0.75rem', opacity: peer.status === 'disconnected' ? 0.6 : 1,
                            minWidth: '190px'
                          }}
                          type="text" 
                          placeholder={currentProvider === 'default' ? "Inherits from global" : "e.g. gpt-4o"}
                          value={currentModelName}
                          disabled={currentProvider === 'default'}
                          onChange={e => handleModelChange(peer.id, 'model', e.target.value)} 
                        />
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <button
                          onClick={() => toggleShare(peer.id)}
                          disabled={peer.status === 'disconnected'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: isShared ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                            border: `1px solid ${isShared ? 'var(--accent)' : 'var(--glass-border)'}`,
                            color: isShared ? 'var(--accent)' : 'var(--text-secondary)',
                            padding: '6px 12px', borderRadius: '6px', cursor: peer.status === 'disconnected' ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                            opacity: peer.status === 'disconnected' ? 0.5 : 1
                          }}
                        >
                          <Share2 size={14} />
                          {isShared ? 'SHARING' : 'SHARE'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Info Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={14} color="#f59e0b" />
              Status: In Development
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.5' }}>
              The agent-specific <strong>LLM Model</strong> selection feature is currently available as a visual interface (UI Preview). The router integration to the backend engine (Python/Node.js) is under active development.
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#3b82f6" />
              Memory Sharing
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              Enabling Memory Share allows connected agents to read and write to your local RAG database. Only enable this for trusted nodes in your local Swarm.
            </p>
          </div>
          
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '16px' }}>NETWORK STATS</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Peers</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{peers.filter(p => p.status === 'connected').length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Avg Latency</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {peers.filter(p => p.status === 'connected').length > 0 
                  ? Math.round(peers.filter(p => p.status === 'connected').reduce((a, b) => a + b.latency, 0) / peers.filter(p => p.status === 'connected').length) + 'ms'
                  : '--'
                }
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Protocol</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}>P2P (TCP)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Swarm;
