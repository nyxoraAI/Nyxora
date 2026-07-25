import React, { useState, useRef, useEffect } from 'react';
import { Search, Globe, FileText, Key, CheckCircle2, AlertTriangle, Loader2, Save, ChevronDown } from 'lucide-react';
import { apiFetch } from './utils/api';

interface WebSearchProps {
  config: any;
  onConfigChange: (newConfig: any) => void;
}

const CustomSelect = ({ value, options, onChange }: { value: string, options: {value: string, label: string}[], onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOption = options.find(o => o.value === value) || options[0];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--accent-text)', padding: '12px 20px', borderRadius: '9999px', fontSize: '0.95rem', outline: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>{currentOption?.label}</span>
        <ChevronDown size={18} color="var(--accent-text)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <ul className="network-dropdown-menu styled-scroll" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', zIndex: 100, maxHeight: '250px', overflowY: 'auto' }}>
          {options.map(opt => (
            <li 
              key={opt.value}
              className={`network-dropdown-item ${opt.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{ padding: '12px 16px' }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const WebSearch: React.FC<WebSearchProps> = ({ config, onConfigChange }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'ok' | 'err'} | null>(null);

  if (!config) return null;

  const webSearchConfig = config.web_search || { provider: 'duckduckgo', enabled: false, scraper: 'jina' };
  const credentials = config.credentials || {};

  const handleUpdate = (updates: any) => {
    onConfigChange({ ...config, web_search: { ...webSearchConfig, ...updates } });
  };

  const handleCredentialUpdate = (key: string, value: string) => {
    onConfigChange({ ...config, credentials: { ...credentials, [key]: value } });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setToast({ msg: 'Configuration saved successfully!', type: 'ok' });
      } else {
        setToast({ msg: 'Failed to save configuration', type: 'err' });
      }
    } catch (e) {
      setToast({ msg: 'Network error', type: 'err' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="overview-container" style={{ padding: '24px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '10px' }}>
            <Search size={24} color="#3b82f6" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Web Search & Scraping</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Configure how the agent browses and extracts real-time information.
            </p>
          </div>
        </div>
        
        <button onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}>
          {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save
        </button>
      </div>

      {toast && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', background: toast.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: toast.type === 'ok' ? '#10b981' : '#ef4444', border: `1px solid ${toast.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {toast.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

      {/* Main Toggle */}
      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '12px' }}>GLOBAL STATUS</div>
      
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={16} color="var(--accent)" /> Enable Web Search Capability
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Allows the agent to autonomously search the internet when it needs up-to-date information.</div>
        </div>
        <div onClick={() => handleUpdate({ enabled: !webSearchConfig.enabled })} style={{ width: '44px', height: '24px', borderRadius: '12px', background: webSearchConfig.enabled ? 'var(--accent)' : 'var(--glass-border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: '3px', left: webSearchConfig.enabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: webSearchConfig.enabled ? '#fff' : 'var(--text-secondary)', transition: 'left 0.2s' }} />
        </div>
      </div>

      {/* Engine Configuration */}
      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '12px' }}>ENGINE CONFIGURATION</div>
      
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px', fontSize: '0.95rem' }}>Search Provider</label>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>The search engine used to query for links.</p>
          <CustomSelect 
            value={webSearchConfig.provider} 
            onChange={(val) => handleUpdate({ provider: val })}
            options={[
              { value: "duckduckgo", label: "DuckDuckGo (Free, No API Key)" },
              { value: "tavily", label: "Tavily (Optimized for AI Agents)" },
              { value: "brave", label: "Brave Search (Privacy Focused)" },
              { value: "serpapi", label: "SerpAPI (Google Search)" },
              { value: "mesh", label: "Mesh Search (Decentralized)" }
            ]}
          />
          
          {/* Conditional Provider Config */}
          {webSearchConfig.provider === 'tavily' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Tavily API Key</label>
              </div>
              <input 
                type="password" 
                placeholder="tvly-..."
                value={credentials['tavily_key'] || ''}
                onChange={(e) => handleCredentialUpdate('tavily_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}

          {webSearchConfig.provider === 'brave' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Brave Search API Key</label>
              </div>
              <input 
                type="password" 
                placeholder="BSA..."
                value={credentials['brave_key'] || ''}
                onChange={(e) => handleCredentialUpdate('brave_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}

          {webSearchConfig.provider === 'serpapi' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>SerpAPI Key</label>
              </div>
              <input 
                type="password" 
                placeholder="Paste API Key here..."
                value={credentials['serpapi_key'] || ''}
                onChange={(e) => handleCredentialUpdate('serpapi_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
          <label style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px', fontSize: '0.95rem' }}>Extraction & Scraping Engine</label>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>The method used to read and convert target websites into LLM-readable Markdown.</p>
          <CustomSelect 
            value={webSearchConfig.scraper || 'default'} 
            onChange={(val) => handleUpdate({ scraper: val })}
            options={[
              { value: "default", label: "Default (System Built-in Engine)" },
              { value: "jina", label: "Jina Reader (Recommended - Fast URL to Markdown)" },
              { value: "crawl4ai", label: "Crawl4AI (Advanced open-source LLM extraction)" },
              { value: "firecrawl", label: "Firecrawl (Powerful API by Mendable)" },
              { value: "browserbase", label: "Browserbase (Serverless Headless Browser)" },
              { value: "puppeteer", label: "Puppeteer (Local Headless Browser)" },
              { value: "cheerio", label: "Cheerio (Basic static HTML parser)" }
            ]}
          />

          {/* Conditional Scraper Config */}
          {webSearchConfig.scraper === 'crawl4ai' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Crawl4AI API Endpoint</label>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '8px', marginTop: 0 }}>URL where your Crawl4AI Docker container or API is running.</p>
              <input 
                type="text" 
                placeholder="http://localhost:11227/crawl"
                value={credentials['crawl4ai_endpoint'] || ''}
                onChange={(e) => handleCredentialUpdate('crawl4ai_endpoint', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}

          {webSearchConfig.scraper === 'firecrawl' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Firecrawl API Key</label>
              </div>
              <input 
                type="password" 
                placeholder="fc-..."
                value={credentials['firecrawl_key'] || ''}
                onChange={(e) => handleCredentialUpdate('firecrawl_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}

          {webSearchConfig.scraper === 'jina' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Jina API Key (Optional)</label>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '8px', marginTop: 0 }}>Add a Jina API key to increase your rate limits for Jina Reader.</p>
              <input 
                type="password" 
                placeholder="jina_..."
                value={credentials['jina_key'] || ''}
                onChange={(e) => handleCredentialUpdate('jina_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}

          {webSearchConfig.scraper === 'browserbase' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Key size={14} color="var(--accent)" />
                  <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Project ID</label>
                </div>
                <input 
                  type="text" 
                  placeholder="Project ID..."
                  value={credentials['browserbase_project_id'] || ''}
                  onChange={(e) => handleCredentialUpdate('browserbase_project_id', e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Key size={14} color="var(--accent)" />
                  <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>API Key</label>
                </div>
                <input 
                  type="password" 
                  placeholder="API Key..."
                  value={credentials['browserbase_key'] || ''}
                  onChange={(e) => handleCredentialUpdate('browserbase_key', e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fallback & Advanced Credentials */}
      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '12px' }}>FALLBACK CONFIGURATION</div>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px', fontSize: '0.95rem' }}>Fallback Search Provider</label>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>The AI will automatically switch to this backup provider if your primary Search Provider fails or is rate-limited.</p>
          <CustomSelect 
            value={webSearchConfig.fallback_provider || 'duckduckgo'} 
            onChange={(val) => handleUpdate({ fallback_provider: val })}
            options={[
              { value: "duckduckgo", label: "DuckDuckGo (Free, No API Key)" },
              { value: "tavily", label: "Tavily (Optimized for AI Agents)" },
              { value: "brave", label: "Brave Search (Privacy Focused)" },
              { value: "serpapi", label: "SerpAPI (Google Search)" },
              { value: "mesh", label: "Mesh Search (Decentralized)" }
            ]}
          />
          
          {webSearchConfig.fallback_provider === 'tavily' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Tavily API Key (Fallback)</label>
              </div>
              <input 
                type="password" 
                placeholder="tvly-..."
                value={credentials['tavily_key'] || ''}
                onChange={(e) => handleCredentialUpdate('tavily_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}

          {webSearchConfig.fallback_provider === 'brave' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Brave Search API Key (Fallback)</label>
              </div>
              <input 
                type="password" 
                placeholder="BSA..."
                value={credentials['brave_key'] || ''}
                onChange={(e) => handleCredentialUpdate('brave_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}

          {webSearchConfig.fallback_provider === 'serpapi' && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Key size={14} color="var(--accent)" />
                <label style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>SerpAPI Key (Fallback)</label>
              </div>
              <input 
                type="password" 
                placeholder="Paste API Key here..."
                value={credentials['serpapi_key'] || ''}
                onChange={(e) => handleCredentialUpdate('serpapi_key', e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '9999px', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebSearch;
