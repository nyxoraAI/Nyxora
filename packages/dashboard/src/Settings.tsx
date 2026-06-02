import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Save, User, Cpu, Key, Network, Globe } from 'lucide-react';
import { PillSelect } from './components/PillSelect';

interface Config {
  agent: { name: string; default_chain: string };
  llm: { provider: string; model: string; temperature: number; api_keys?: string[] };
  web3?: { rpc_urls?: Record<string, string | string[]> };
}

interface SettingsProps {
  config: Config | null;
  onConfigChange: (newConfig: Config) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onConfigChange }) => {
  const [formData, setFormData] = useState<Config | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        agent: {
          name: config.agent?.name || 'Nyxora',
          default_chain: config.agent?.default_chain || 'base'
        },
        llm: {
          provider: config.llm?.provider || 'openai',
          model: config.llm?.model || 'gpt-4o-mini',
          temperature: config.llm?.temperature ?? 0.2,
          api_keys: Array.isArray(config.llm?.api_keys) 
            ? config.llm.api_keys 
            : (config.llm?.api_keys ? [config.llm.api_keys as unknown as string] : [])
        },
        web3: {
          rpc_urls: config.web3?.rpc_urls || {}
        }
      });
    }
  }, [config]);

  if (!formData) return <div className="overview-container">Loading settings...</div>;

  const handleChange = (section: 'agent' | 'llm', field: string, value: string | number) => {
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: field === 'temperature' ? Number(value) : value
        }
      };
    });
  };

  const handleWeb3Change = (chainName: string, value: string) => {
    setFormData(prev => {
      if (!prev) return prev;
      const urls = value.split(',').map(s => s.trim()).filter(s => s);
      const newRpcUrls = { ...(prev.web3?.rpc_urls || {}) };
      
      if (urls.length === 0) {
        delete newRpcUrls[chainName];
      } else if (urls.length === 1) {
        newRpcUrls[chainName] = urls[0];
      } else {
        newRpcUrls[chainName] = urls;
      }
      
      return {
        ...prev,
        web3: {
          ...prev.web3,
          rpc_urls: newRpcUrls
        }
      };
    });
  };

  const handleAddApiKey = () => {
    setFormData(prev => {
      if (!prev) return prev;
      const currentKeys = prev.llm.api_keys || [];
      if (currentKeys.length >= 10) return prev;
      return { ...prev, llm: { ...prev.llm, api_keys: [...currentKeys, ''] } };
    });
  };

  const handleUpdateApiKey = (index: number, value: string) => {
    setFormData(prev => {
      if (!prev) return prev;
      const newKeys = [...(prev.llm.api_keys || [])];
      newKeys[index] = value;
      return { ...prev, llm: { ...prev.llm, api_keys: newKeys } };
    });
  };

  const handleRemoveApiKey = (index: number) => {
    setFormData(prev => {
      if (!prev) return prev;
      const newKeys = [...(prev.llm.api_keys || [])];
      newKeys.splice(index, 1);
      return { ...prev, llm: { ...prev.llm, api_keys: newKeys } };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onConfigChange(formData);
        alert('Settings saved successfully!');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="overview-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="overview-header" style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#eceff4' }}>Configuration</h1>
        <p style={{ color: '#d8dee9' }}>Modify the core behaviors and parameters of the Nyxora Agent.</p>
      </div>

      <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="nord-panel-header">
          <User size={18} color="#81a1c1" />
          <h3>Agent Profile</h3>
        </div>
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="nord-label">Agent Name</label>
            <input 
              className="nord-pill-input"
              type="text" 
              value={formData.agent.name} 
              onChange={e => handleChange('agent', 'name', e.target.value)} 
            />
          </div>
          <div className="form-group flex-1">
            <label className="nord-label">Default Web3 Chain</label>
            <PillSelect 
              value={formData.agent.default_chain}
              onChange={(val) => handleChange('agent', 'default_chain', val)}
              pillColor="#88c0d0"
              textColor="#000000"
              options={[
                { id: 'ethereum', label: 'Ethereum Mainnet', icon: <Globe size={14} /> },
                { id: 'bsc', label: 'BNB Chain', icon: <Globe size={14} /> },
                { id: 'base', label: 'Base', icon: <Globe size={14} /> },
                { id: 'optimism', label: 'Optimism', icon: <Globe size={14} /> },
                { id: 'arbitrum', label: 'Arbitrum', icon: <Globe size={14} /> },
                { id: 'sepolia', label: 'Sepolia Testnet', icon: <Globe size={14} /> }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '32px' }}>
        <div className="nord-panel-header">
          <Cpu size={18} color="#81a1c1" />
          <h3>LLM Engine</h3>
        </div>
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="nord-label">Provider</label>
            <PillSelect 
              value={formData.llm.provider}
              onChange={(val) => handleChange('llm', 'provider', val)}
              pillColor="#81a1c1"
              textColor="#000000"
              options={[
                { id: 'gemini', label: 'Google Gemini', icon: <Cpu size={14} /> },
                { id: 'openai', label: 'OpenAI', icon: <Cpu size={14} /> },
                { id: 'openrouter', label: 'OpenRouter', icon: <Cpu size={14} /> },
                { id: 'ollama', label: 'Ollama (Local)', icon: <Cpu size={14} /> }
              ]}
            />
          </div>
          <div className="form-group flex-1">
            <label className="nord-label">Model Name</label>
            <input 
              className="nord-pill-input"
              style={{ color: '#81a1c1' }}
              type="text" 
              value={formData.llm.model} 
              onChange={e => handleChange('llm', 'model', e.target.value)} 
            />
          </div>
          <div className="form-group flex-1">
            <label className="nord-label">Temperature ({formData.llm.temperature})</label>
            <input 
              className="nord-slider"
              type="range" 
              min="0" max="1" step="0.1"
              value={formData.llm.temperature} 
              onChange={e => handleChange('llm', 'temperature', e.target.value)} 
            />
          </div>
        </div>
      </div>

      <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '32px' }}>
        <div className="nord-panel-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={18} color="#81a1c1" />
            <h3>API Keys (Rotation)</h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#81a1c1', fontWeight: 600 }}>
            {formData.llm.api_keys?.length || 0} / 10 Keys
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#d8dee9', marginBottom: '20px' }}>
          Add up to 10 API keys. The system will automatically rotate through them (Round-Robin) for each request to prevent rate limits. Leave empty to fallback to default credentials set via CLI (nyxora setup).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(formData.llm.api_keys || []).map((key, index) => (
            <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input 
                className="nord-input"
                type="password" 
                value={key}
                placeholder="sk-..."
                onChange={(e) => handleUpdateApiKey(index, e.target.value)}
              />
              <button 
                onClick={() => handleRemoveApiKey(index)}
                style={{ 
                  background: 'rgba(191, 97, 106, 0.15)', 
                  color: '#bf616a', 
                  border: '1px solid rgba(191, 97, 106, 0.3)', 
                  borderRadius: '6px', 
                  padding: '10px 16px', 
                  cursor: 'pointer', 
                  transition: 'all 0.2s',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(191, 97, 106, 0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(191, 97, 106, 0.15)'}
              >
                Delete
              </button>
            </div>
          ))}

          {(!formData.llm.api_keys || formData.llm.api_keys.length < 10) && (
            <button 
              onClick={handleAddApiKey}
              style={{ 
                alignSelf: 'flex-start', 
                background: 'transparent', 
                color: '#81a1c1', 
                border: '1px dashed #434c5e', 
                borderRadius: '6px', 
                padding: '10px 20px', 
                cursor: 'pointer', 
                marginTop: '8px', 
                transition: 'all 0.2s',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#81a1c1';
                e.currentTarget.style.background = 'rgba(129, 161, 193, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#434c5e';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              + Add API Key
            </button>
          )}
        </div>
      </div>

      <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '40px' }}>
        <div className="nord-panel-header">
          <Network size={18} color="#81a1c1" />
          <h3>Web3 & RPC Settings</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#d8dee9', marginBottom: '20px' }}>
          Override the default public RPCs with your own Premium endpoints (Alchemy/Infura). 
          Separate multiple URLs with a comma for Fallback High-Availability.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {['ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'sepolia'].map(chain => {
            const rpcVal = formData.web3?.rpc_urls?.[chain];
            const displayVal = Array.isArray(rpcVal) ? rpcVal.join(', ') : (rpcVal || '');
            return (
              <div key={chain} className="form-group" style={{ position: 'relative' }}>
                <label className="nord-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img 
                    src={`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain === 'bsc' ? 'smartchain' : chain}/info/logo.png`} 
                    alt={chain} 
                    style={{ width: '14px', height: '14px', borderRadius: '50%' }}
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                  {chain} RPC
                </label>
                <input 
                  className="nord-input"
                  type="text" 
                  placeholder="https://..." 
                  value={displayVal}
                  onChange={(e) => handleWeb3Change(chain, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(216, 222, 233, 0.05)' }}>
        <button className="nord-btn-primary" onClick={handleSave} disabled={isSaving}>
          <Save size={16} style={{ marginRight: '8px' }} />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
