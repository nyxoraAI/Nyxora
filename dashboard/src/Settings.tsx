import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

interface Config {
  agent: { name: string; default_chain: string };
  llm: { provider: string; model: string; temperature: number };
}

interface SettingsProps {
  config: Config | null;
  onConfigChange: (newConfig: Config) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onConfigChange }) => {
  const [formData, setFormData] = useState<Config | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) setFormData(config);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('http://localhost:3000/api/config', {
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
    <div className="overview-container">
      <div className="overview-header">
        <h1>Configuration</h1>
        <p>Modify the core behaviors and parameters of the OpenWeb Agent.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Agent Profile</h3>
        </div>
        <div className="form-row">
          <div className="form-group flex-1">
            <label>Agent Name</label>
            <input 
              type="text" 
              value={formData.agent.name} 
              onChange={e => handleChange('agent', 'name', e.target.value)} 
            />
          </div>
          <div className="form-group flex-1">
            <label>Default Web3 Chain</label>
            <select 
              value={formData.agent.default_chain}
              onChange={e => handleChange('agent', 'default_chain', e.target.value)}
            >
              <option value="sepolia">Sepolia Testnet</option>
              <option value="ethereum">Ethereum Mainnet</option>
              <option value="base">Base</option>
              <option value="bsc">BNB Chain</option>
              <option value="arbitrum">Arbitrum</option>
              <option value="optimism">Optimism</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>LLM Engine</h3>
        </div>
        <div className="form-row">
          <div className="form-group flex-1">
            <label>Provider</label>
            <select 
              value={formData.llm.provider}
              onChange={e => handleChange('llm', 'provider', e.target.value)}
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>
          <div className="form-group flex-1">
            <label>Model Name</label>
            <input 
              type="text" 
              value={formData.llm.model} 
              onChange={e => handleChange('llm', 'model', e.target.value)} 
            />
          </div>
          <div className="form-group flex-1">
            <label>Temperature ({formData.llm.temperature})</label>
            <input 
              type="range" 
              min="0" max="1" step="0.1"
              value={formData.llm.temperature} 
              onChange={e => handleChange('llm', 'temperature', e.target.value)} 
              style={{ padding: '0', background: 'transparent' }}
            />
          </div>
        </div>
      </div>

      <div className="attention-panel" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <div className="attention-header" style={{ color: '#3b82f6' }}>
          <span className="attention-icon">ℹ️</span>
          <h4>API Keys Note</h4>
        </div>
        <div className="attention-content">
          <p>API keys for Gemini and OpenAI are loaded securely from your <code>.env</code> file.</p>
          <span className="text-secondary">If you need to change your API keys or injected wallet private key, please edit the .env file and restart the backend server manually.</span>
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '32px' }}>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
          <Save size={16} style={{ marginRight: '8px', display: 'inline' }} />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
