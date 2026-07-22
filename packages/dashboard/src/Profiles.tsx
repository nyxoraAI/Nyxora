import React, { useState, useEffect } from 'react';
import { PillSelect } from './components/PillSelect';
import { Save, User, Shield, Key, Globe } from 'lucide-react';
import { apiFetch } from './utils/api';
import { FiatSelector } from './FiatSelector';
import { getChainLogoUrl } from './utils/logos';

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
  llm: any;
  web3?: any;
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

interface ProfilesProps {
  config: Config | null;
  onConfigChange: (newConfig: Config) => void;
  autoLockTime: number;
  setAutoLockTime: (val: number) => void;
  onLogout?: () => void;
}

export const Profiles: React.FC<ProfilesProps> = ({ config, onConfigChange, autoLockTime, setAutoLockTime, onLogout }) => {
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
  const [saveStatus, setSaveStatus] = useState('');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passSaveStatus, setPassSaveStatus] = useState('');
  
  const [wipingMemory, setWipingMemory] = useState(false);
  const [supportedFiats, setSupportedFiats] = useState<string[]>(['usd', 'idr', 'eur', 'jpy', 'gbp', 'aud']);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/supported_vs_currencies')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setSupportedFiats(data); })
      .catch(() => {});

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
      .catch(() => {});

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
      .catch(() => {});

    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleAgentChange = (field: string, value: any) => {
    setFormData(prev => {
      if (!prev) return prev;
      return { ...prev, agent: { ...prev.agent, [field]: value } };
    });
  };

  const handleWipeMemory = async () => {
    if (confirm("DANGER: Are you sure you want to permanently wipe all episodic memory? This cannot be undone.")) {
      setWipingMemory(true);
      try {
        const res = await apiFetch('/api/memory/all', { method: 'DELETE' });
        if (res.ok) alert("Episodic memory wiped completely.");
        else alert("Failed to wipe memory.");
      } catch {
        alert("Failed to wipe memory.");
      } finally {
        setWipingMemory(false);
      }
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
    } catch {
      setPassSaveStatus('Connection failed');
    }
    setTimeout(() => setPassSaveStatus(''), 4000);
  };

  const handleSave = async () => {
    if (!formData) return;
    setIsSaving(true);
    setSaveStatus('');
    try {
      await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      await apiFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile)
      });
      await apiFetch('/api/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyConfig)
      });
      setSaveStatus('Saved successfully');
      onConfigChange(formData);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData) return <div className="overview-container">Loading...</div>;

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
          <User size={24} color="var(--accent)" />
          Profiles & Security
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saveStatus && (
            <span style={{ fontSize: '0.9rem', color: saveStatus.includes('Failed') ? 'var(--danger)' : 'var(--accent)' }}>
              {saveStatus}
            </span>
          )}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="save-button"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Profiles'}
          </button>
        </div>
      </div>

      <div className="nord-panel" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
        <div className="nord-panel-header" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Agent Identity</h3>
        </div>
        <div className="form-row" style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Agent Name</label>
            <input 
              className="nord-pill-input"
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              type="text" 
              value={formData.agent.name} 
              onChange={e => handleAgentChange('name', e.target.value)} 
            />
          </div>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Default Web3 Chain</label>
            <PillSelect 
              value={formData.agent.default_chain}
              onChange={(val) => handleAgentChange('default_chain', val)}
              pillColor="transparent"
              textColor="var(--text-primary)"
              options={[
                { id: 'ethereum', label: 'Ethereum Mainnet', icon: <ChainIcon id="ethereum" /> },
                { id: 'bsc', label: 'BNB Chain', icon: <ChainIcon id="bsc" /> },
                { id: 'base', label: 'Base', icon: <ChainIcon id="base" /> },
                { id: 'arbitrum', label: 'Arbitrum One', icon: <ChainIcon id="arbitrum" /> },
                { id: 'sepolia', label: 'Sepolia Testnet', icon: <ChainIcon id="sepolia" /> }
              ]}
            />
          </div>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Default Slippage (%)</label>
            <input 
              className="nord-pill-input"
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              type="text" 
              placeholder="e.g. 0.5 or auto"
              value={formData.agent.default_slippage ?? 'auto'} 
              onChange={e => {
                const val = e.target.value;
                if (val.toLowerCase() === 'auto' || val === '') handleAgentChange('default_slippage', 'auto');
                else handleAgentChange('default_slippage', val);
              }} 
              onBlur={e => {
                const val = String(e.target.value);
                if (val.toLowerCase() !== 'auto') {
                   const num = parseFloat(val);
                   handleAgentChange('default_slippage', isNaN(num) ? 'auto' : num);
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="nord-panel" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
        <div className="nord-panel-header" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--danger)' }}>Risk & Policy Engine</h3>
        </div>
        <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Risk Tolerance Level</label>
            <PillSelect 
              value={userProfile.risk_level}
              onChange={(val) => setUserProfile({ ...userProfile, risk_level: val })}
              pillColor="transparent"
              textColor="var(--danger)"
              options={[
                { id: 'Conservative', label: 'Conservative (Safe)' },
                { id: 'Moderate', label: 'Moderate' },
                { id: 'Aggressive', label: 'Aggressive (Degen)' }
              ]}
            />
          </div>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Max USD per Transaction</label>
            <input 
              className="nord-pill-input"
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              type="number" 
              step="1"
              value={policyConfig.max_usd_per_tx} 
              onChange={e => setPolicyConfig({ ...policyConfig, max_usd_per_tx: parseFloat(e.target.value) || 0 })} 
            />
          </div>
        </div>
        
        <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem' }}>Restrictions</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="require_approval"
                  checked={policyConfig.require_approval}
                  onChange={e => setPolicyConfig({ ...policyConfig, require_approval: e.target.checked })}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '16px', height: '16px', margin: 0 }}
                />
                <label htmlFor="require_approval" style={{ margin: 0, cursor: 'pointer', fontSize: '0.85rem' }}>
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
                <label htmlFor="whitelist_only" style={{ margin: 0, cursor: 'pointer', fontSize: '0.85rem' }}>
                  Strict Whitelist Only (Block unknown addresses)
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="avoid_memecoins"
                  checked={userProfile.avoid_memecoins}
                  onChange={e => setUserProfile({ ...userProfile, avoid_memecoins: e.target.checked })}
                  style={{ cursor: 'pointer', accentColor: 'var(--danger)', width: '16px', height: '16px', margin: 0 }}
                />
                <label htmlFor="avoid_memecoins" style={{ margin: 0, cursor: 'pointer', fontSize: '0.85rem' }}>
                  Strictly Avoid Memecoins / Unknown Contracts
                </label>
              </div>
            </div>
          </div>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Custom LLM Rules (Natural Language)</label>
            <textarea 
              className="nord-input"
              rows={4}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', resize: 'vertical' }}
              placeholder="e.g. Never buy a token if liquidity is below $10,000&#10;Do not touch drive E" 
              value={policyConfig.custom_llm_rules.join('\n')}
              onChange={e => setPolicyConfig({ ...policyConfig, custom_llm_rules: e.target.value.split('\n').filter(r => r.trim().length > 0) })}
            />
          </div>
        </div>
      </div>

      <div className="nord-panel" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}>
        <div className="nord-panel-header" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Security & System</h3>
        </div>
        <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Auto-Lock Session (Idle Timeout)</label>
            <PillSelect 
              value={autoLockTime.toString()}
              onChange={(val) => setAutoLockTime(parseInt(val))}
              pillColor="transparent"
              textColor="var(--text-primary)"
              options={[
                { id: '0', label: 'Off' },
                { id: '15', label: '15 Minutes' },
                { id: '30', label: '30 Minutes' },
                { id: '60', label: '1 Hour' }
              ]}
            />
          </div>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Memory & Operations</label>
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
                fontWeight: 'bold'
              }}
            >
              {wipingMemory ? 'Wiping...' : 'Wipe All Episodic Memory (Panic Button)'}
            </button>
          </div>
        </div>
        
        <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Change Dashboard Password</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="password" 
                placeholder="Old Password" 
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px' }}
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="New Password" 
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px' }}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <button 
                style={{ padding: '0 16px', borderRadius: '4px', background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={handlePasswordChange}
                disabled={!oldPassword || !newPassword}
              >
                Update
              </button>
            </div>
            {passSaveStatus && <span style={{ fontSize: '0.85rem', color: passSaveStatus.includes('success') ? 'var(--success)' : 'var(--danger)', marginTop: '4px', display: 'block' }}>{passSaveStatus}</span>}
          </div>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Manual Lock</label>
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

        <div className="form-row" style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Base Fiat Currency</label>
            <FiatSelector 
              value={formData.agent.base_fiat || 'usd'}
              onChange={(val) => handleAgentChange('base_fiat', val)}
              options={supportedFiats}
            />
          </div>
          <div className="form-group flex-1" style={{ flex: 1 }}>
            <label className="nord-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Backend Log Level</label>
            <PillSelect 
              value={formData.agent.log_level || 'info'}
              onChange={(val) => handleAgentChange('log_level', val)}
              pillColor="transparent"
              textColor="var(--text-primary)"
              options={[
                { id: 'info', label: 'Info (Standard)' },
                { id: 'debug', label: 'Debug (Verbose)' }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profiles;
