import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Save, User, Cpu, Key, Network, Globe, Shield } from 'lucide-react';
import { PillSelect } from './components/PillSelect';
import { getChainLogoUrl } from './utils/logos';
import { GoogleAuthWizard } from './components/GoogleAuthWizard';

const ChainIcon = ({ id }: { id: string }) => (
  <div style={{ width: '14px', height: '14px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <img 
      src={getChainLogoUrl(id)} 
      alt={id} 
      style={{ width: '14px', height: '14px', objectFit: 'cover', borderRadius: '50%' }} 
      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
    />
  </div>
);

interface Config {
  agent: { name: string; default_chain: string; default_slippage?: number };
  llm: { provider: string; model: string; temperature: number };
  web3?: { rpc_urls?: Record<string, string | string[]>; explorer_api_key?: string };
}

interface SettingsProps {
  config: Config | null;
  onConfigChange: (newConfig: Config) => void;
  autoLockTime: number;
  setAutoLockTime: (val: number) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onConfigChange, autoLockTime, setAutoLockTime }) => {
  const [formData, setFormData] = useState<Config | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGoogleWizard, setShowGoogleWizard] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        agent: {
          name: config.agent?.name || 'Nyxora',
          default_chain: config.agent?.default_chain || 'base',
          default_slippage: config.agent?.default_slippage || 0.5
        },
        llm: {
          provider: config.llm?.provider || 'openai',
          model: config.llm?.model || 'gpt-4',
          temperature: config.llm?.temperature || 0.7
        },
        web3: {
          rpc_urls: config.web3?.rpc_urls || {},
          explorer_api_key: config.web3?.explorer_api_key || ''
        }
      });
    }
  }, [config]);

  if (!formData) return <div className="overview-container">Loading settings...</div>;

  const handleChange = (section: 'agent' | 'llm' | 'web3', field: string, value: string | number) => {
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
                { id: 'ethereum', label: 'Ethereum Mainnet', icon: <ChainIcon id="ethereum" /> },
                { id: 'bsc', label: 'BNB Chain', icon: <ChainIcon id="bsc" /> },
                { id: 'base', label: 'Base', icon: <ChainIcon id="base" /> },
                { id: 'arbitrum', label: 'Arbitrum One', icon: <ChainIcon id="arbitrum" /> },
                { id: 'optimism', label: 'OP Mainnet', icon: <ChainIcon id="optimism" /> },
                { id: 'polygon', label: 'Polygon (Matic)', icon: <ChainIcon id="polygon" /> },
                { id: 'sepolia', label: 'Sepolia Testnet', icon: <ChainIcon id="sepolia" /> },
                { id: 'base_sepolia', label: 'Base Sepolia Testnet', icon: <ChainIcon id="base_sepolia" /> },
                { id: 'arbitrum_sepolia', label: 'Arbitrum Sepolia', icon: <ChainIcon id="arbitrum_sepolia" /> },
                { id: 'optimism_sepolia', label: 'OP Sepolia', icon: <ChainIcon id="optimism_sepolia" /> }
              ]}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="nord-label">Default Slippage (%)</label>
            <input 
              className="nord-pill-input"
              type="number" 
              step="0.1"
              min="0.1"
              max="50"
              value={formData.agent.default_slippage ?? 0.5} 
              onChange={e => handleChange('agent', 'default_slippage', parseFloat(e.target.value) || 0.5)} 
            />
          </div>
          <div className="form-group flex-1"></div>
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
                { id: 'ollama', label: 'Ollama (Local)', icon: <Cpu size={14} /> },
                { id: 'groq', label: 'Groq', icon: <Cpu size={14} /> },
                { id: 'mistral', label: 'Mistral AI', icon: <Cpu size={14} /> },
                { id: 'xai', label: 'xAI (Grok)', icon: <Cpu size={14} /> },
                { id: 'deepseek', label: 'DeepSeek', icon: <Cpu size={14} /> }
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

      <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '40px' }}>
        <div className="nord-panel-header">
          <Shield size={18} color="#ebcb8b" />
          <h3>Security & Privacy</h3>
        </div>
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="nord-label">Auto-Lock Session (Idle Timeout)</label>
            <PillSelect 
              value={autoLockTime.toString()}
              onChange={(val) => setAutoLockTime(parseInt(val))}
              pillColor="#ebcb8b"
              textColor="#2e3440"
              options={[
                { id: '0', label: 'Off' },
                { id: '15', label: '15 Minutes' },
                { id: '30', label: '30 Minutes' },
                { id: '60', label: '1 Hour' }
              ]}
            />
          </div>
          <div className="form-group flex-1"></div>
        </div>
      </div>

      <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '40px' }}>
        <div className="nord-panel-header">
          <Key size={18} color="#a3be8c" />
          <h3>Integrations</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#d8dee9', marginBottom: '20px' }}>
          Connect Nyxora to external services to expand its capabilities.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(163, 190, 140, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(163, 190, 140, 0.2)' }}>
          <div>
            <h4 style={{ color: '#eceff4', margin: '0 0 4px 0' }}>Google Workspace</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#d8dee9' }}>Allow Nyxora to securely read emails and write to Google Drive locally.</p>
          </div>
          <button 
            className="nord-btn-primary" 
            style={{ background: '#a3be8c', color: '#2e3440', fontWeight: 600 }}
            onClick={() => setShowGoogleWizard(true)}
          >
            Setup OAuth
          </button>
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
        <div style={{ marginBottom: '24px' }} className="form-group">
          <label className="nord-label">Etherscan API V2 Key (Unified - All Networks)</label>
          <input 
            className="nord-input"
            type="text" 
            placeholder="Leaves empty to use free public endpoints" 
            value={formData.web3?.explorer_api_key || ''}
            onChange={(e) => handleChange('web3', 'explorer_api_key', e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {['ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'sepolia', 'base_sepolia', 'arbitrum_sepolia', 'optimism_sepolia'].map(chain => {
            const rpcVal = formData.web3?.rpc_urls?.[chain];
            const displayVal = Array.isArray(rpcVal) ? rpcVal.join(', ') : (rpcVal || '');
            return (
              <div key={chain} className="form-group" style={{ position: 'relative' }}>
                <label className="nord-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img 
                    src={`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain === 'bsc' ? 'smartchain' : chain.replace('_sepolia', '')}/info/logo.png`} 
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

      {showGoogleWizard && <GoogleAuthWizard onClose={() => setShowGoogleWizard(false)} />}
    </div>
  );
};

export default Settings;
