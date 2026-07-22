import React, { useState, useEffect } from 'react';
import { Zap, Play, Plus, Clock, ArrowRight, ToggleLeft, RefreshCw, FileText, Loader2, Edit, Trash2, X, Save } from 'lucide-react';
import { apiFetch } from './utils/api';

export const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorFilename, setEditorFilename] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [isNewFile, setIsNewFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchWorkflows = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/playbooks');
      const data = await res.json();
      if (Array.isArray(data)) {
        setWorkflows(data.map((p: any) => ({
          id: p.filename,
          name: p.filename,
          trigger: 'Executed via CLI or Agent',
          action: p.content?.substring(0, 50) + '...',
          content: p.content,
          status: p.status || 'active',
          runs: 0
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (filename: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setWorkflows(prev => prev.map(w => w.id === filename ? { ...w, status: newStatus } : w));
    try {
      await apiFetch('/api/playbooks/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, active: newStatus === 'active' })
      });
    } catch (e) {
      setWorkflows(prev => prev.map(w => w.id === filename ? { ...w, status: currentStatus } : w));
      alert("Failed to toggle playbook");
    }
  };

  const openEditor = (filename: string, content: string, isNew: boolean) => {
    setEditorFilename(filename);
    setEditorContent(content);
    setIsNewFile(isNew);
    setIsEditorOpen(true);
  };

  const handleCreateScenario = () => {
    openEditor('', '# New Scenario\n\nAdd instructions for the agent here.', true);
  };

  const handleEdit = (wf: any) => {
    openEditor(wf.name, wf.content, false);
  };

  const handleSavePlaybook = async () => {
    if (!editorFilename) return alert("Filename is required");
    setIsSaving(true);
    try {
      await apiFetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: editorFilename, content: editorContent })
      });
      setIsEditorOpen(false);
      fetchWorkflows();
    } catch (e) {
      alert("Failed to save playbook");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await apiFetch(`/api/playbooks?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      fetchWorkflows();
    } catch (e) {
      alert("Failed to delete playbook");
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  return (
    <div className="overview-container" style={{ padding: '24px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '10px' }}>
            <Zap size={24} color="#f59e0b" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Workflows & Playbooks</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              List of agent playbooks and automated instructions (from the `playbooks` folder).
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchWorkflows} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: 'pointer' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={handleCreateScenario} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={16} /> Create New Scenario
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '16px' }}>ACTIVE PLAYBOOKS LIST</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
          </div>
        ) : workflows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            No playbooks found.
          </div>
        ) : workflows.map(wf => (
          <div key={wf.id} style={{ background: 'var(--bg-secondary)', border: `1px solid ${wf.status === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'var(--glass-border)'}`, borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: wf.status === 'active' ? 1 : 0.6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <FileText size={20} color="#3b82f6" />
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace' }}>{wf.name}</h3>
                {wf.status === 'active' && (
                  <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)' }}>ACTIVE</span>
                )}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <Play size={16} color="#f59e0b" />
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>CONTENT / ACTION</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{wf.action}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px', marginLeft: '24px' }}>
              <button
                onClick={() => handleToggle(wf.id, wf.status)}
                style={{
                  position: 'relative', width: '40px', height: '22px',
                  borderRadius: '11px', background: wf.status === 'active' ? 'var(--accent)' : 'var(--glass-border)',
                  border: 'none', cursor: 'pointer', transition: 'background 0.3s ease', padding: 0
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px',
                  left: wf.status === 'active' ? '20px' : '2px', width: '18px', height: '18px',
                  borderRadius: '50%', background: '#fff',
                  transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }} />
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(wf)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>
                  <Edit size={16} />
                </button>
                <button onClick={() => handleDelete(wf.id)} style={{ background: 'var(--danger)', border: '1px solid var(--danger)', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isEditorOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: 'var(--bg-color)', border: '1px solid var(--glass-border)', borderRadius: '12px', width: '100%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{isNewFile ? 'Create New Scenario' : 'Edit Scenario'}</h3>
              <button onClick={() => setIsEditorOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filename (e.g., folder/SKILL.md)</label>
                <input 
                  value={editorFilename}
                  onChange={e => setEditorFilename(e.target.value)}
                  disabled={!isNewFile}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px', fontFamily: 'monospace', opacity: isNewFile ? 1 : 0.7 }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Markdown Content</label>
                <textarea 
                  value={editorContent}
                  onChange={e => setEditorContent(e.target.value)}
                  style={{ width: '100%', flex: 1, padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'none' }}
                />
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-secondary)' }}>
              <button onClick={() => setIsEditorOpen(false)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSavePlaybook} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} 
                {isSaving ? 'Saving...' : 'Save Playbook'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Workflows;
