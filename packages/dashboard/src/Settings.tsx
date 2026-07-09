import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Save, User, Cpu, Key, Network, Globe, Shield, Zap, Terminal, Database, Plug, BookOpen } from 'lucide-react';
import { PillSelect } from './components/PillSelect';
import { LlmIcon } from './components/LlmIcons';
import { getChainLogoUrl } from './utils/logos';
import { GoogleAuthWizard } from './components/GoogleAuthWizard';
import { FiatSelector } from './FiatSelector';
import Skills from './Skills';
import OsSkills from './OsSkills';
import ExternalSkills from './ExternalSkills';
import Playbooks from './Playbooks';
import { DefiKeys } from './DefiKeys';
import { MarketOracles } from './MarketOracles';
import RpcConfig from './RpcConfig';
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
  agent: { name: string; default_chain: string; default_slippage?: number | 'auto'; log_level?: string; base_fiat?: string };
  llm: { provider: string; model: string; temperature: number; base_url?: string; reasoning_effort?: 'low' | 'medium' | 'high' };
  web3?: { rpc_urls?: Record<string, string | string[]>; explorer_api_key?: string };
}

interface UserProfile {
  risk_level: string;
  max_slippage: number;
  avoid_memecoins: boolean;
}

interface PolicyConfig {
  max_usd_per_tx: number;
  whitelist_only: boolean;
  require_approval: boolean;
  custom_llm_rules: string[];
}

interface SettingsProps {
  config: Config | null;
  onConfigChange: (newConfig: Config) => void;
  autoLockTime: number;
  setAutoLockTime: (val: number) => void;
  onLogout?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onConfigChange, autoLockTime, setAutoLockTime, onLogout }) => {
  const [activeCategory, setActiveCategory] = useState<string>('agent');
  const [formData, setFormData] = useState<Config | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    risk_level: 'Moderate',
    max_slippage: 1.0,
    avoid_memecoins: false
  });
  const [policyConfig, setPolicyConfig] = useState<PolicyConfig>({
    max_usd_per_tx: 999999999,
    whitelist_only: false,
    require_approval: true,
    custom_llm_rules: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passSaveStatus, setPassSaveStatus] = useState('');

  const [showGoogleWizard, setShowGoogleWizard] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [authUrlInput, setAuthUrlInput] = useState('');
  const [supportedFiats, setSupportedFiats] = useState<string[]>(['usd', 'idr', 'eur', 'jpy', 'gbp', 'aud']);
  const [wipingMemory, setWipingMemory] = useState(false);

  useEffect(() => {
    // Fetch Google Status
    apiFetch('/api/auth/google/status')
      .then(res => res.json())
      .then(data => { if (data) setGoogleConnected(data.connected); })
      .catch(() => {});

    fetch('https://api.coingecko.com/api/v3/simple/supported_vs_currencies')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSupportedFiats(data);
        }
      })
      .catch(err => console.error('Failed to load supported fiats', err));
  }, []);

  const handleWipeMemory = async () => {
    if (confirm("DANGER: Are you sure you want to permanently wipe all episodic memory? This cannot be undone.")) {
      setWipingMemory(true);
      try {
        const res = await apiFetch('/api/memory/all', { method: 'DELETE' });
        if (res.ok) {
          alert("Episodic memory wiped completely.");
        } else {
          alert("Failed to wipe memory.");
        }
      } catch (err) {
        alert("Failed to wipe memory.");
      } finally {
        setWipingMemory(false);
      }
    }
  };

  useEffect(() => {
    // Fetch User Profile
    apiFetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setUserProfile({
            risk_level: data.risk_level || 'Moderate',
            max_slippage: data.max_slippage || 1.0,
            avoid_memecoins: Boolean(data.avoid_memecoins)
          });
        }
      })
      .catch(err => console.error('Failed to load profile', err));

    // Fetch Policy Config
    apiFetch('/api/policy')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setPolicyConfig({
            max_usd_per_tx: data.max_usd_per_tx ?? 999999999,
            whitelist_only: data.whitelist_only ?? false,
            require_approval: data.require_approval ?? true,
            custom_llm_rules: data.custom_llm_rules || []
          });
        }
      })
      .catch(err => console.error('Failed to load policy', err));

    if (config) {
      setFormData({
        agent: {
          name: config.agent?.name || 'Nyxora',
          default_chain: config.agent?.default_chain || 'base',
          default_slippage: config.agent?.default_slippage || 0.5,
          log_level: config.agent?.log_level || 'info',
          base_fiat: config.agent?.base_fiat || 'usd'
        },
        llm: {
          provider: config.llm?.provider || 'openai',
          model: config.llm?.model || 'gpt-4',
          temperature: config.llm?.temperature || 0.7,
          base_url: config.llm?.base_url || '',
          reasoning_effort: config.llm?.reasoning_effort || 'medium'
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
      
      const newSectionData = { ...prev[section] } as any;
      newSectionData[field] = field === 'temperature' ? Number(value) : value;

      // Clean up base_url if provider changes and it's not custom_provider
      if (section === 'llm' && field === 'provider' && value !== 'custom_provider') {
        newSectionData.base_url = '';
      }

      return {
        ...prev,
        [section]: newSectionData
      };
    });
  };

  const handleWeb3Change = (chainName: string, value: string) => {
    setFormData(prev => {
      if (!prev) return prev;
      const urls = value.split(',').map(s => s.trim()).filter(s => s);
      const newRpcUrls = { ...prev.web3?.rpc_urls };
      
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
      
      if (userProfile) {
        try {
          await apiFetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProfile)
          });
        } catch (e) {
          console.error('Failed to save profile', e);
        }
      }

      if (policyConfig) {
        try {
          await apiFetch('/api/policy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(policyConfig)
          });
        } catch (e) {
          console.error('Failed to save policy', e);
        }
      }

      if (res.ok) {
        onConfigChange(formData);
        setIsSaving(false);
        setTimeout(() => alert('Settings saved successfully!'), 50);
      } else {
        throw new Error('Failed to save main config');
      }
    } catch (e) {
      setSaveStatus('Error saving policy');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsSaving(false);
      setSavingPolicy(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setPassSaveStatus('Saving...');
      const res = await apiFetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPassSaveStatus('Password updated successfully');
        setOldPassword('');
        setNewPassword('');
      } else {
        setPassSaveStatus(data.error || 'Failed to update password');
      }
    } catch (err) {
      setPassSaveStatus('Connection failed');
    }
    setTimeout(() => setPassSaveStatus(''), 4000);
  };

  return (
    <div className="settings-layout" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div className="settings-sidebar-menu" style={{ width: '260px', borderRight: '1px solid var(--glass-border)', padding: '24px 16px', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        <div className="settings-section-title" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '4px', paddingLeft: '12px' }}>GENERAL</div>
        
        <div className={`settings-menu-item ${activeCategory === 'agent' ? 'active' : ''}`} onClick={() => setActiveCategory('agent')}>
          <User size={16} /> <span className="settings-menu-label">Agent Profile</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'llm' ? 'active' : ''}`} onClick={() => setActiveCategory('llm')}>
          <Cpu size={16} /> <span className="settings-menu-label">LLM Engine</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'appearance' ? 'active' : ''}`} onClick={() => setActiveCategory('appearance')}>
          <Globe size={16} /> <span className="settings-menu-label">Appearance</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'security' ? 'active' : ''}`} onClick={() => setActiveCategory('security')}>
          <Shield size={16} /> <span className="settings-menu-label">Security & Privacy</span>
        </div>

        <div className="settings-section-title" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginTop: '16px', marginBottom: '4px', paddingLeft: '12px' }}>AGENT CAPABILITIES</div>
        
        <div className={`settings-menu-item ${activeCategory === 'web3skills' ? 'active' : ''}`} onClick={() => setActiveCategory('web3skills')}>
          <Zap size={16} /> <span className="settings-menu-label">Web3 Skills</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'osskills' ? 'active' : ''}`} onClick={() => setActiveCategory('osskills')}>
          <Terminal size={16} /> <span className="settings-menu-label">OS Skills</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'externalskills' ? 'active' : ''}`} onClick={() => setActiveCategory('externalskills')}>
          <Plug size={16} /> <span className="settings-menu-label">External Skills</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'playbooks' ? 'active' : ''}`} onClick={() => setActiveCategory('playbooks')}>
          <BookOpen size={16} /> <span className="settings-menu-label">Skill Store</span>
        </div>

        <div className="settings-section-title" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginTop: '16px', marginBottom: '4px', paddingLeft: '12px' }}>ADVANCED</div>
        
        <div className={`settings-menu-item ${activeCategory === 'risk' ? 'active' : ''}`} onClick={() => setActiveCategory('risk')}>
          <Shield size={16} /> <span className="settings-menu-label">Risk & Policy</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'rpc' ? 'active' : ''}`} onClick={() => setActiveCategory('rpc')}>
          <Network size={16} /> <span className="settings-menu-label">RPC Config</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'defi' ? 'active' : ''}`} onClick={() => setActiveCategory('defi')}>
          <Key size={16} /> <span className="settings-menu-label">DeFi Config</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'oracles' ? 'active' : ''}`} onClick={() => setActiveCategory('oracles')}>
          <Database size={16} /> <span className="settings-menu-label">Market Oracles</span>
        </div>
        <div className={`settings-menu-item ${activeCategory === 'integrations' ? 'active' : ''}`} onClick={() => setActiveCategory('integrations')}>
          <Key size={16} /> <span className="settings-menu-label">Integrations</span>
        </div>

      </div>

      <div className="settings-content-area styled-scroll" style={{ flex: 1, padding: '32px 48px', overflowY: 'auto' }}>
        
        <div className="settings-scroll-container" style={{ margin: '0' }}>
          
          {activeCategory === 'agent' && (
            <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div className="nord-panel-header">
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
                    pillColor="var(--accent)"
                    textColor="var(--bg-secondary)"
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
                    type="text" 
                    placeholder="e.g. 0.5 or auto"
                    value={formData.agent.default_slippage ?? 'auto'} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val.toLowerCase() === 'auto' || val === '') {
                        handleChange('agent', 'default_slippage', 'auto');
                      } else {
                        handleChange('agent', 'default_slippage', val);
                      }
                    }} 
                    onBlur={e => {
                      const val = String(e.target.value);
                      if (val.toLowerCase() !== 'auto') {
                         const num = parseFloat(val);
                         handleChange('agent', 'default_slippage', isNaN(num) ? 'auto' : num);
                      }
                    }}
                  />
                </div>
                <div className="form-group flex-1"></div>
              </div>
            </div>
          )}

          {activeCategory === 'llm' && (
            <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div className="nord-panel-header">
                <h3>LLM Engine</h3>
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="nord-label">Provider</label>
                  <PillSelect 
                    value={formData.llm.provider}
                    onChange={(val) => handleChange('llm', 'provider', val)}
                    pillColor="var(--accent)"
                    textColor="var(--bg-secondary)"
                    options={[
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
                <div className="form-group flex-1">
                  <label className="nord-label">Model Name</label>
                  <input 
                    className="nord-pill-input"
                    style={{ color: 'var(--text-secondary)' }}
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
              <div className="form-row" style={{ marginTop: '16px' }}>
                <div className="form-group flex-1">
                  <label className="nord-label">Reasoning Effort (O1/O3)</label>
                  <PillSelect 
                    value={formData.llm.reasoning_effort || 'medium'}
                    onChange={(val) => handleChange('llm', 'reasoning_effort', val)}
                    pillColor="var(--accent)"
                    textColor="var(--bg-secondary)"
                    options={[
                      { id: 'low', label: 'Low' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'high', label: 'High' }
                    ]}
                  />
                </div>
                <div className="form-group flex-2" style={{ flex: 2 }}></div>
              </div>
              {formData.llm.provider === 'custom_provider' && (
                <div className="form-row" style={{ marginTop: '16px' }}>
                  <div className="form-group flex-1">
                    <label className="nord-label">Custom API Base URL</label>
                    <input 
                      className="nord-pill-input"
                      type="text" 
                      placeholder="e.g. http://localhost:1234/v1"
                      value={formData.llm.base_url || ''} 
                      onChange={e => handleChange('llm', 'base_url', e.target.value)} 
                    />
                  </div>
                </div>
              )}
              {formData.llm.provider === '9router' && (
                <div style={{ background: 'rgba(136, 192, 208, 0.1)', border: '1px solid rgba(136, 192, 208, 0.3)', padding: '14px', borderRadius: '8px', marginTop: '16px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--accent)' }}>ℹ️ Local Proxy Required:</strong> Ensure you have installed and started the 9Router proxy before saving.
                    <br/><br/>
                    <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'monospace' }}>npm install -g 9router</code>
                    <br/>
                    <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px', marginTop: '6px', display: 'inline-block', fontSize: '0.8rem', fontFamily: 'monospace' }}>9router</code>
                  </p>
                </div>
              )}
            </div>
          )}

          {activeCategory === 'appearance' && (
            <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div className="nord-panel-header">
                <h3>Appearance & UI Personalization</h3>
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="nord-label">Base Fiat Currency</label>
                  <FiatSelector 
                    value={formData.agent.base_fiat || 'usd'}
                    onChange={(val) => handleChange('agent', 'base_fiat', val)}
                    options={supportedFiats}
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Used across the dashboard for cosmetic fiat conversion. Core backend operations remain strictly in USD.
                  </p>
                </div>
                <div className="form-group flex-1">
                  <label className="nord-label">Dashboard Theme</label>
                  <PillSelect 
                    value={localStorage.getItem('nyxora_theme') || 'auto'}
                    onChange={(val) => {
                      localStorage.setItem('nyxora_theme', val);
                      window.location.reload();
                    }}
                    pillColor="var(--accent)"
                    textColor="var(--bg-secondary)"
                    options={[
                      { id: 'auto', label: 'System (Auto)' },
                      { id: 'dark', label: 'Dark Mode' },
                      { id: 'light', label: 'Light Mode' }
                    ]}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="nord-label">Backend Log Level</label>
                  <PillSelect 
                    value={formData.agent.log_level || 'info'}
                    onChange={(val) => handleChange('agent', 'log_level', val)}
                    pillColor="var(--accent)"
                    textColor="var(--bg-secondary)"
                    options={[
                      { id: 'info', label: 'Info (Standard)' },
                      { id: 'debug', label: 'Debug (Verbose)' }
                    ]}
                  />
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'security' && (
            <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div className="nord-panel-header">
                <h3>Security & Privacy</h3>
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="nord-label">Auto-Lock Session (Idle Timeout)</label>
                  <PillSelect 
                    value={autoLockTime.toString()}
                    onChange={(val) => setAutoLockTime(parseInt(val))}
                    pillColor="var(--accent)"
                    textColor="var(--bg-secondary)"
                    options={[
                      { id: '0', label: 'Off' },
                      { id: '15', label: '15 Minutes' },
                      { id: '30', label: '30 Minutes' },
                      { id: '60', label: '1 Hour' }
                    ]}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="nord-label">Memory & Operations</label>
                  <button 
                    onClick={handleWipeMemory}
                    disabled={wipingMemory}
                    style={{
                      width: '100%',
                      background: 'rgba(191, 97, 106, 0.1)',
                      color: '#BF616A',
                      border: '1px solid rgba(191, 97, 106, 0.5)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: wipingMemory ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => !wipingMemory && (e.currentTarget.style.background = 'rgba(191, 97, 106, 0.2)')}
                    onMouseLeave={(e) => !wipingMemory && (e.currentTarget.style.background = 'rgba(191, 97, 106, 0.1)')}
                  >
                    {wipingMemory ? 'Wiping...' : 'Wipe All Episodic Memory (Panic Button)'}
                  </button>
                </div>
              </div>

              <div className="nord-panel-header" style={{ marginTop: '24px' }}>
                <h3>Dashboard Access</h3>
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="nord-label">Change Dashboard Password</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input 
                      type="password" 
                      placeholder="Old Password" 
                      className="nord-input" 
                      style={{ flex: 1 }}
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                    />
                    <input 
                      type="password" 
                      placeholder="New Password" 
                      className="nord-input" 
                      style={{ flex: 1 }}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                    <button 
                      className="nord-btn-primary" 
                      style={{ padding: '0 16px', borderRadius: '8px' }}
                      onClick={handlePasswordChange}
                      disabled={!oldPassword || !newPassword}
                    >
                      Update
                    </button>
                  </div>
                  {passSaveStatus && <span style={{ fontSize: '0.85rem', color: passSaveStatus.includes('success') ? 'var(--success)' : 'var(--danger)' }}>{passSaveStatus}</span>}
                </div>
                <div className="form-group flex-1">
                  <label className="nord-label">Manual Lock</label>
                  <button 
                    onClick={onLogout}
                    style={{
                      width: '100%',
                      background: 'var(--danger)',
                      color: '#eceff4',
                      border: 'none',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 600
                    }}
                  >
                    <Key size={16} /> Log Out (Lock Dashboard)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'risk' && (
            <>
              <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                <div className="nord-panel-header">
                  <h3 style={{ color: 'var(--danger)' }}>Personalized Risk Profile</h3>
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label className="nord-label">Risk Tolerance Level</label>
                    <PillSelect 
                      value={userProfile.risk_level}
                      onChange={(val) => setUserProfile({ ...userProfile, risk_level: val })}
                      pillColor="var(--danger)"
                      textColor="var(--text-primary)"
                      options={[
                        { id: 'Conservative', label: 'Conservative (Safe)' },
                        { id: 'Moderate', label: 'Moderate' },
                        { id: 'Aggressive', label: 'Aggressive (Degen)' }
                      ]}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label className="nord-label">Max Allowed Slippage (%)</label>
                    <input 
                      className="nord-pill-input"
                      type="number" 
                      step="0.1"
                      value={userProfile.max_slippage} 
                      onChange={e => setUserProfile({ ...userProfile, max_slippage: parseFloat(e.target.value) || 1.0 })} 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px', marginBottom: '5px' }}>
                  <input 
                    type="checkbox" 
                    id="avoid_memecoins"
                    checked={userProfile.avoid_memecoins}
                    onChange={e => setUserProfile({ ...userProfile, avoid_memecoins: e.target.checked })}
                    style={{ cursor: 'pointer', accentColor: 'var(--danger)', width: '16px', height: '16px', margin: 0, flexShrink: 0 }}
                  />
                  <label htmlFor="avoid_memecoins" className="nord-label" style={{ margin: 0, cursor: 'pointer', textTransform: 'none', fontSize: '0.85rem' }}>Strictly Avoid Memecoins / Unknown Contracts</label>
                </div>
              </div>

              <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '40px' }}>
                <div className="nord-panel-header">
                  <h3>Policy Engine (Hard-coded Firewall)</h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Critical limits enforced at the signer level. The LLM cannot override these boundaries.
                </p>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label className="nord-label">Max USD per Transaction</label>
                    <input 
                      className="nord-pill-input"
                      type="number" 
                      step="1"
                      value={policyConfig.max_usd_per_tx} 
                      onChange={e => setPolicyConfig({ ...policyConfig, max_usd_per_tx: parseFloat(e.target.value) || 0 })} 
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label className="nord-label" style={{ marginBottom: '12px', display: 'block' }}>Approval & Restrictions</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="checkbox" 
                          id="require_approval"
                          checked={policyConfig.require_approval}
                          onChange={e => setPolicyConfig({ ...policyConfig, require_approval: e.target.checked })}
                          style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '16px', height: '16px', margin: 0 }}
                        />
                        <label htmlFor="require_approval" className="nord-label" style={{ margin: 0, cursor: 'pointer', textTransform: 'none', fontSize: '0.85rem' }}>
                          Require Manual Approval for every transaction
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="checkbox" 
                          id="whitelist_only"
                          checked={policyConfig.whitelist_only}
                          onChange={e => setPolicyConfig({ ...policyConfig, whitelist_only: e.target.checked })}
                          style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '16px', height: '16px', margin: 0 }}
                        />
                        <label htmlFor="whitelist_only" className="nord-label" style={{ margin: 0, cursor: 'pointer', textTransform: 'none', fontSize: '0.85rem' }}>
                          Strict Whitelist Only (Block unknown addresses)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '15px' }}>
                  <label className="nord-label">Custom LLM Rules (Natural Language)</label>
                  <textarea 
                    className="nord-input"
                    rows={3}
                    style={{ width: '100%', resize: 'vertical' }}
                    placeholder="e.g. Never buy a token if liquidity is below $10,000&#10;Do not touch drive E" 
                    value={policyConfig.custom_llm_rules.join('\n')}
                    onChange={e => setPolicyConfig({ ...policyConfig, custom_llm_rules: e.target.value.split('\n').filter(r => r.trim().length > 0) })}
                  />
                </div>
              </div>
            </>
          )}

          {activeCategory === 'integrations' && (
            <>
              <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                <div className="nord-panel-header">
                  <h3>Integrations</h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Connect Nyxora to external services to expand its capabilities.
                </p>
                <div style={{ background: 'rgba(163, 190, 140, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(163, 190, 140, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Google Workspace</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Allow Nyxora to securely manage emails, calendar, docs, and drive locally.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="nord-btn" 
                        style={{ 
                          background: 'rgba(136, 192, 208, 0.1)', 
                          color: 'var(--accent)', 
                          border: '1px solid rgba(136, 192, 208, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setShowGoogleWizard(true)}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(136, 192, 208, 0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(136, 192, 208, 0.1)'}
                      >
                        <Key size={14} /> Config
                      </button>
                      
                      {googleConnected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(163, 190, 140, 0.1)', color: '#a3be8c', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                            <span style={{ width: '8px', height: '8px', background: '#a3be8c', borderRadius: '50%', display: 'inline-block' }}></span>
                            Connected
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const res = await apiFetch('/api/auth/google', { method: 'DELETE' });
                                if (res.ok) setGoogleConnected(false);
                              } catch (e) {
                                alert('Failed to disconnect.');
                              }
                            }}
                            style={{
                              background: 'transparent',
                              color: '#bf616a',
                              border: '1px solid rgba(191, 97, 106, 0.4)',
                              padding: '8px 16px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                            }}
                          >
                            Disconnect
                          </button>
                        </div>
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
                            } catch (e) {
                              alert('Failed to initiate Google Auth.');
                            }
                          }}
                          style={{
                            background: 'var(--text-primary)',
                            color: 'var(--bg-secondary)',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.9rem'
                          }}
                        >
                          Sign in with Google
                        </button>
                      )}
                    </div>
                  </div>

                  {!googleConnected && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(235, 203, 139, 0.3)' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Used a <strong>Desktop App</strong> credential and got a "Connection Refused" error? Paste the broken URL here:
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="http://localhost/?state=..."
                          value={authUrlInput}
                          onChange={(e) => setAuthUrlInput(e.target.value)}
                          style={{
                            flex: 1,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-primary)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            outline: 'none',
                            fontSize: '0.85rem'
                          }}
                        />
                        <button 
                          className="nord-btn-primary"
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
                            } catch (e) {
                              alert('Network error.');
                            }
                          }}
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '40px' }}>
                <div className="nord-panel-header">
                  <h3>Web3 Explorer Settings</h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Configure blockchain explorer API keys to enable the agent to fetch transaction history.
                </p>
                <div style={{ marginBottom: '24px' }} className="form-group">
                  <label className="nord-label">Etherscan API V2 Key (Unified - All Networks)</label>
                  <input 
                    className="nord-input"
                    type="password" 
                    placeholder="Leaves empty to use free public endpoints" 
                    value={formData.web3?.explorer_api_key || ''}
                    onChange={(e) => handleChange('web3', 'explorer_api_key', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Render integrated configurations */}
          {activeCategory === 'web3skills' && <div style={{ margin: '-24px' }}><Skills /></div>}
          {activeCategory === 'osskills' && <div style={{ margin: '-24px' }}><OsSkills /></div>}
          {activeCategory === 'externalskills' && <div style={{ margin: '-24px' }}><ExternalSkills /></div>}
          {activeCategory === 'playbooks' && <div style={{ margin: '-24px' }}><Playbooks /></div>}
          {activeCategory === 'rpc' && <div style={{ margin: '-24px' }}><RpcConfig /></div>}
          {activeCategory === 'defi' && <div style={{ margin: '-24px' }}><DefiKeys /></div>}
          {activeCategory === 'oracles' && <div style={{ margin: '-24px' }}><MarketOracles /></div>}

          {/* Save Button for standard settings form */}
          {['agent', 'llm', 'appearance', 'security', 'risk', 'integrations'].includes(activeCategory) && (
            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(216, 222, 233, 0.05)' }}>
              <button className="nord-btn-primary" style={{ background: 'var(--accent)', color: 'var(--bg-secondary)', fontWeight: 600 }} onClick={handleSave} disabled={isSaving}>
                <Save size={16} style={{ marginRight: '8px' }} />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          )}

          {showGoogleWizard && <GoogleAuthWizard onClose={() => setShowGoogleWizard(false)} />}
        </div>
      </div>
    </div>
  );
};

export default Settings;
