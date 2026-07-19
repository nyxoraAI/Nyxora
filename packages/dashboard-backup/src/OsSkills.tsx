import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Compass, Search, Terminal, FileText, FileEdit, Globe, ShieldAlert, AlertTriangle, FileSearch, Search as SearchIcon, Mail, Calendar, FileSpreadsheet, BookOpen, ClipboardList, GitBranch, MessageCircle, Layout, Mic, AlignLeft, Scissors } from 'lucide-react';

interface SkillParam {
  type: string;
  description?: string;
  enum?: string[];
}

interface SkillDefinition {
  type: string;
  isActive?: boolean;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, SkillParam>;
      required: string[];
    };
  };
}

const formatSkillName = (name: string) => {
  let formatted = name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  if (name === 'run_terminal_command') {
    formatted += ' (UNSAFE)';
  }
  return formatted;
};

const getSkillIcon = (skillName: string, isActive: boolean) => {
  const color = isActive !== false ? "var(--accent)" : "var(--tool-bg)";
  const size = 20;
  switch (formatSkillName(skillName).toLowerCase()) {
    case 'run terminal command (unsafe)': return <Terminal size={size} color={color} />;
    case 'read local file': return <FileText size={size} color={color} />;
    case 'write local file': return <FileEdit size={size} color={color} />;
    case 'browse website': return <Globe size={size} color={color} />;
    case 'update security policy': return <ShieldAlert size={size} color={color} />;

    case 'analyze document': return <FileSearch size={size} color={color} />;
    case 'search web': return <SearchIcon size={size} color={color} />;
    case 'read gmail inbox': return <Mail size={size} color={color} />;
    case 'list calendar events': return <Calendar size={size} color={color} />;
    case 'append row to sheets': return <FileSpreadsheet size={size} color={color} />;
    case 'read google docs': return <BookOpen size={size} color={color} />;
    case 'read google form responses': return <ClipboardList size={size} color={color} />;
    case 'edit local file': return <Scissors size={size} color={color} />;
    case 'execute git command': return <GitBranch size={size} color={color} />;
    case 'manage twitter': return <MessageCircle size={size} color={color} />;
    case 'manage notion': return <Layout size={size} color={color} />;
    case 'transcribe audio': return <Mic size={size} color={color} />;
    case 'summarize text': return <AlignLeft size={size} color={color} />;
    default: return <Compass size={size} color={color} />;
  }
};

const OsSkills: React.FC = () => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingToggle, setPendingToggle] = useState<{skillName: string, currentStatus: boolean} | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [authUrlInput, setAuthUrlInput] = useState('');

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await apiFetch('/api/skills/system');
        if (res.ok) setSkills(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSkills();
  }, []);

  const handleToggle = async (skillName: string, currentStatus: boolean) => {
    if (skillName === 'run_terminal_command' && !currentStatus) {
      setPendingToggle({ skillName, currentStatus });
      return;
    }
    await executeToggle(skillName, currentStatus);
  };

  const executeToggle = async (skillName: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    // Optimistic UI update
    setSkills(prev => prev.map(s => 
      s.function.name === skillName ? { ...s, isActive: newStatus } : s
    ));

    try {
      await apiFetch('/api/skills/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName, active: newStatus })
      });
    } catch (e) {
      // Revert on error
      setSkills(prev => prev.map(s => 
        s.function.name === skillName ? { ...s, isActive: currentStatus } : s
      ));
      console.error('Failed to toggle OS skill', e);
    }
  };

  if (isLoading) return <div className="settings-subpanel">Loading OS skills...</div>;

  const filteredSkills = skills.filter(skill => 
    skill.function.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.function.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="settings-subpanel">
      <div className="overview-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text-primary)' }}>OS Skills</h1>
        <p style={{ color: 'var(--text-secondary)' }}>System-level capabilities for the agent OS.</p>
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: 'rgba(46, 52, 64, 0.4)', 
        border: '1px solid rgba(216, 222, 233, 0.1)', 
        borderRadius: '8px', 
        padding: '0 16px',
        marginBottom: '24px'
      }}>
        <Search size={18} color="#9ca3af" />
        <input 
          type="text" 
          placeholder="Filter OS skills..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            outline: 'none', 
            color: 'var(--text-primary)', 
            padding: '16px', 
            width: '100%',
            fontSize: '0.95rem'
          }}
        />
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{filteredSkills.length} shown</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredSkills.map((skill, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'var(--bg-sidebar)',
            padding: '20px 24px',
            borderRadius: '8px',
            border: '1px solid rgba(216, 222, 233, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
              <div style={{ marginTop: '2px' }}>
                {getSkillIcon(skill.function.name, skill.isActive !== false)}
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: skill.isActive !== false ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  {formatSkillName(skill.function.name)}
                </h3>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem', lineHeight: '1.5', maxWidth: '800px' }}>
                  {skill.function.description}
                </p>
              </div>
            </div>
            
            <div style={{ marginLeft: '24px' }}>
              <button 
                onClick={() => handleToggle(skill.function.name, skill.isActive !== false)}
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '22px',
                  borderRadius: '11px',
                  background: skill.isActive !== false ? 'var(--accent)' : 'var(--tool-bg)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.3s ease',
                  padding: 0
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: skill.isActive !== false ? '20px' : '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Warning Modal */}
      {pendingToggle && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid rgba(191, 97, 106, 0.4)',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(191, 97, 106, 0.1)', padding: '12px', borderRadius: '50%' }}>
                <AlertTriangle size={32} color="#bf616a" />
              </div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>DANGER ZONE: System Access</h2>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              You are about to enable <strong>Terminal Execution</strong>. This grants the AI agent 
              <strong> full, unrestrained access</strong> to execute arbitrary shell scripts on your host operating system.
            </p>
            <p style={{ color: '#bf616a', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '32px' }}>
              ⚠️ The agent could read sensitive files, modify your system, or execute harmful commands if prompted maliciously.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setPendingToggle(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  executeToggle(pendingToggle.skillName, pendingToggle.currentStatus);
                  setPendingToggle(null);
                }}
                style={{
                  background: '#bf616a',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                I Understand the Risks, Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OsSkills;
