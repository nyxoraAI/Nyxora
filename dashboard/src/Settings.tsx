import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

interface Config {
  agent: { name: string; default_chain: string };
  llm: { provider: string; model: string; temperature: number; api_keys?: string[] };
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
        <p>Modify the core behaviors and parameters of the Nyxora Agent.</p>
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
              <option value="openrouter">OpenRouter</option>
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

      <div className="panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>API Keys (Rotation)</h3>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {formData.llm.api_keys?.length || 0} / 10 Keys
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
          Add up to 10 API keys. The system will automatically rotate through them (Round-Robin) for each request to prevent rate limits. Leave empty to fallback to .env file.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(formData.llm.api_keys || []).map((key, index) => (
            <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="password" 
                value={key}
                placeholder="sk-..."
                onChange={(e) => handleUpdateApiKey(index, e.target.value)}
                style={{ flex: 1, padding: '10px 14px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'white' }}
              />
              <button 
                onClick={() => handleRemoveApiKey(index)}
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
              >
                Delete
              </button>
            </div>
          ))}

          {(!formData.llm.api_keys || formData.llm.api_keys.length < 10) && (
            <button 
              onClick={handleAddApiKey}
              style={{ alignSelf: 'flex-start', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px dashed #3b82f6', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', marginTop: '8px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
            >
              + Add API Key
            </button>
          )}
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
