import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api';
import { BookOpen, Plus, Save, Trash2, Code, FileText, AlertTriangle, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import './index.css';

interface Playbook {
  filename: string;
  content: string;
}

const Playbooks: React.FC = () => {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [newFilename, setNewFilename] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const groupedPlaybooks = playbooks.reduce((acc, p) => {
    const parts = p.filename.split(/[/\\]/); // Support both slashes
    const isRoot = parts.length === 1;
    const folder = isRoot ? 'Root' : parts[0];
    const label = isRoot ? parts[0] : parts.slice(1).join('/');
    
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push({ ...p, label });
    return acc;
  }, {} as Record<string, (Playbook & { label: string })[]>);

  // Auto-expand folder of selected file when it changes
  useEffect(() => {
    if (selectedFilename && !isCreating) {
      const parts = selectedFilename.split(/[/\\]/);
      if (parts.length > 1) {
        setExpandedFolders(prev => ({ ...prev, [parts[0]]: true }));
      }
    }
  }, [selectedFilename, isCreating]);

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const fetchPlaybooks = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/playbooks');
      if (res.ok) {
        const data = await res.json();
        setPlaybooks(data || []);
        if (data && data.length > 0 && !selectedFilename && !isCreating) {
          handleSelect(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch playbooks", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (p: Playbook) => {
    setSelectedFilename(p.filename);
    setEditContent(p.content);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedFilename(null);
    setNewFilename('my-new-skill.md');
    setEditContent('---\nname: my-new-skill\ndescription: "Description here"\n---\n\n# Instructions\n\n1. Run command `...`\n');
  };

  const handleSave = async () => {
    const targetFilename = isCreating ? newFilename : selectedFilename;
    if (!targetFilename) return;
    
    try {
      await apiFetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: targetFilename, content: editContent })
      });
      await fetchPlaybooks();
      if (isCreating) {
        setIsCreating(false);
        setSelectedFilename(targetFilename);
      }
    } catch (err) {
      console.error("Failed to save playbook", err);
      alert("Failed to save playbook.");
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await apiFetch(`/api/playbooks?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      setSelectedFilename(null);
      await fetchPlaybooks();
    } catch (err) {
      console.error("Failed to delete playbook", err);
      alert("Failed to delete playbook.");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <div style={{ width: '300px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--panel-bg)' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <BookOpen size={18} /> Skill Store
          </div>
          <button onClick={handleCreateNew} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px' }} title="New Playbook">
            <Plus size={18} />
          </button>
        </div>
        <div className="styled-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {isLoading && playbooks.length === 0 ? (
            <div style={{ padding: '15px', textAlign: 'center', opacity: 0.5 }}>Loading...</div>
          ) : (
            Object.entries(groupedPlaybooks)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([folder, items]) => {
                const isExpanded = expandedFolders[folder] === true; // Default to false
                return (
                  <div key={folder} style={{ marginBottom: '2px' }}>
                    <div 
                      onClick={() => toggleFolder(folder)}
                      style={{ 
                        padding: '8px 15px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        userSelect: 'none'
                      }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Folder size={14} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {folder} ({items.length})
                      </span>
                    </div>
                    
                    {isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {items.map(p => {
                          const isSelected = selectedFilename === p.filename && !isCreating;
                          return (
                            <div 
                              key={p.filename} 
                              onClick={() => handleSelect(p)}
                              style={{
                                padding: '8px 15px 8px 38px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? 'var(--highlight-bg, rgba(255,255,255,0.05))' : 'transparent',
                                borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize: '13px',
                                transition: 'all 0.2s ease',
                                userSelect: 'none'
                              }}
                              title={p.filename}
                            >
                              <FileText size={14} opacity={isSelected ? 1 : 0.6} style={{ flexShrink: 0 }} />
                              <span style={{ 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                flex: 1
                              }}>
                                {p.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Right Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
        {(selectedFilename || isCreating) ? (
          <>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <Code size={18} opacity={0.7} />
                {isCreating ? (
                  <input 
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    placeholder="e.g. custom-skill.md"
                    style={{ flex: 1, maxWidth: '300px', padding: '6px 10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                  />
                ) : (
                  <span style={{ fontWeight: 600 }}>{selectedFilename}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isCreating && selectedFilename && (
                  <button 
                    onClick={() => handleDelete(selectedFilename)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <button 
                  onClick={handleSave}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                >
                  <Save size={14} /> Save
                </button>
              </div>
            </div>
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <AlertTriangle size={14} color="#f39c12" />
                Playbooks are written in Markdown. Nyxora reads these instructions to execute terminal commands autonomously.
              </div>
              <textarea
                className="styled-scroll"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  resize: 'none',
                  padding: '15px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  outline: 'none'
                }}
              />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <BookOpen size={48} opacity={0.2} style={{ marginBottom: '16px' }} />
            <h3>Select a Playbook</h3>
            <p>Or create a new one to teach Nyxora new skills.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Playbooks;
