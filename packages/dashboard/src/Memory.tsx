import React, { useState, useEffect, useRef } from 'react';
import { Brain, Search, Trash2, Upload, Database, FileText, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { apiFetch } from './utils/api';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const Memory: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch('/api/memory');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMemories(data.map((m: any) => ({
          id: m.id,
          fact: m.fact,
          category: m.category || 'general',
          rule_type: m.rule_type || 'observation',
          confidence: m.confidence || 0,
          occurrences: m.occurrences || 1,
          date: new Date(m.createdAt || m.lastSeen || Date.now()).toLocaleDateString()
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/memory/${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      alert("Failed to delete memory");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert("Document successfully uploaded and vectorized!");
        fetchMemories(); // Refresh the list so new chunks appear
      }
    } catch (err) {
      alert("Failed to upload document");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredMemories = memories.filter(m => 
    m.fact?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="overview-container" style={{ padding: '24px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', padding: '10px' }}>
            <Brain size={24} color="#8b5cf6" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Memory & Knowledge</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Manage agent context, episodic memories, and RAG knowledge base.
            </p>
          </div>
        </div>
        <button onClick={fetchMemories} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: 'pointer' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Kolom Kiri: Ingatan Jangka Panjang */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '12px' }}>LONG-TERM MEMORY</div>
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0 12px', marginBottom: '16px' }}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search specific memories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', padding: '10px 12px', flex: 1, fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', paddingRight: '8px' }}>
            {isLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading memories...</div>
            ) : filteredMemories.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No memories found.</div>
            ) : filteredMemories.map(mem => (
              <div key={mem.id} style={{ display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: '16px' }}>
                  <div 
                    className="markdown-body"
                    style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.9rem', lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(mem.fact || '', { async: false }) as string) }}
                  />
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '6px' }}>
                    Category: {mem.category} | Type: {mem.rule_type} | Confidence: {(mem.confidence * 100).toFixed(0)}% | Occurrences: {mem.occurrences}
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(mem.id)}
                  style={{ background: 'var(--danger)', color: '#eceff4', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom Kanan: RAG Documents */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '12px' }}>KNOWLEDGE BASE (RAG)</div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.md" style={{ display: 'none' }} />
          
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--glass-border)', borderRadius: '8px', padding: '24px', textAlign: 'center', marginBottom: '16px', cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'border-color 0.2s', opacity: isUploading ? 0.7 : 1 }} 
            onMouseEnter={e => !isUploading && (e.currentTarget.style.borderColor = 'var(--accent)')} 
            onMouseLeave={e => !isUploading && (e.currentTarget.style.borderColor = 'var(--glass-border)')}
          >
            {isUploading ? (
              <Loader2 size={24} color="var(--accent)" className="spin" style={{ margin: '0 auto 12px' }} />
            ) : (
              <Upload size={24} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
            )}
            <h4 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>
              {isUploading ? 'Processing Document...' : 'Upload Document'}
            </h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              {isUploading ? 'Extracting text and generating vectors' : 'PDF, TXT, MD (Max 10MB)'}
            </p>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', padding: '12px', display: 'flex', gap: '10px' }}>
            <Database size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Uploaded documents are automatically chunked and stored as <strong>DOCUMENT</strong> memories in the long-term list on the left.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Memory;
