import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Trash2, Download } from 'lucide-react';

interface MemoryEntry {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  tool_calls?: any[];
}

const Memory: React.FC = () => {
  const [history, setHistory] = useState<MemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMemory = async () => {
    try {
      const res = await apiFetch('http://localhost:3000/api/history');
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemory();
  }, []);

  const handleClear = async () => {
    if (!confirm('Are you sure you want to wipe the agent memory? This cannot be undone.')) return;
    try {
      await apiFetch('http://localhost:3000/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "agent_memory.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (isLoading) return <div className="overview-container">Loading memory...</div>;

  return (
    <div className="overview-container">
      <div className="overview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Memory Vault</h1>
          <p>Long-term storage and conversational context of the Agent.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={14} style={{ marginRight: '6px', display: 'inline' }}/>
            Export JSON
          </button>
          <button className="btn-primary" style={{ background: '#ef4444' }} onClick={handleClear}>
            <Trash2 size={14} style={{ marginRight: '6px', display: 'inline' }}/>
            Wipe Memory
          </button>
        </div>
      </div>

      <div className="panel">
        {history.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Memory is completely empty.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {history.map((entry, idx) => (
              <div key={idx} style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                background: entry.role === 'user' ? 'rgba(59, 130, 246, 0.1)' : 
                            entry.role === 'assistant' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                borderLeft: `4px solid ${entry.role === 'user' ? '#3b82f6' : entry.role === 'assistant' ? '#22c55e' : '#94a3b8'}`
              }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}>
                  {entry.role} {entry.name ? `(${entry.name})` : ''}
                </div>
                <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                  {entry.content}
                </div>
                {entry.tool_calls && entry.tool_calls.length > 0 && (
                  <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#fb923c' }}>
                    <strong>Tool Calls:</strong>
                    <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                      {JSON.stringify(entry.tool_calls, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Memory;
