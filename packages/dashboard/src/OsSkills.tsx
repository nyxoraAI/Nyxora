import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Compass, Search, Terminal, FileText, FileEdit, Globe, ShieldAlert, AlertTriangle, FileSearch, Search as SearchIcon, Mail, Calendar, FileSpreadsheet, BookOpen, ClipboardList, GitBranch, Twitter, Layout, Mic, AlignLeft, Scissors } from 'lucide-react';

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
  const color = isActive !== false ? "#88c0d0" : "#4c566a";
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
    case 'manage twitter': return <Twitter size={size} color={color} />;
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
    const fetchGoogleStatus = async () => {
      try {
        const res = await apiFetch('/api/auth/google/status');
        if (res.ok) {
          const data = await res.json();
          setGoogleConnected(data.connected);
        }
      } catch (e) {
        console.error('Failed to fetch Google Auth status', e);
      }
    };
    fetchSkills();
    fetchGoogleStatus();
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

  if (isLoading) return <div className="overview-container">Loading OS skills...</div>;

  const filteredSkills = skills.filter(skill => 
    skill.function.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.function.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="overview-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div className="overview-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#eceff4' }}>OS Skills</h1>
        <p style={{ color: '#d8dee9' }}>System-level capabilities for the agent OS.</p>
      </div>

      {/* Account Linking Panel */}
      <div style={{
        background: '#3b4252',
        border: '1px solid rgba(216, 222, 233, 0.1)',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', color: '#eceff4', fontSize: '1.1rem' }}>Account Linking</h3>
          <p style={{ margin: 0, color: '#d8dee9', fontSize: '0.9rem' }}>
            Connect your Google Workspace to unlock Gmail and Calendar skills.
          </p>
        </div>
        <div>
          {googleConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(163, 190, 140, 0.1)', color: '#a3be8c', padding: '8px 16px', borderRadius: '6px', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', background: '#a3be8c', borderRadius: '50%', display: 'inline-block' }}></span>
                Connected to Google
              </div>
              <button
                onClick={async () => {
                  try {
                    const res = await apiFetch('/api/auth/google', { method: 'DELETE' });
                    if (res.ok) {
                      setGoogleConnected(false);
                    }
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
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(191, 97, 106, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
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
                    alert('Setup Required: ' + (data.error || 'Please add google-credentials.json to ~/.nyxora/'));
                  }
                } catch (e) {
                  alert('Failed to initiate Google Auth. Is the backend running?');
                }
              }}
              style={{
                background: '#eceff4',
                color: '#2e3440',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          )}
        </div>
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
            color: '#eceff4', 
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
            background: '#3b4252',
            padding: '20px 24px',
            borderRadius: '8px',
            border: '1px solid rgba(216, 222, 233, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
              <div style={{ marginTop: '2px' }}>
                {getSkillIcon(skill.function.name, skill.isActive !== false)}
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: skill.isActive !== false ? '#eceff4' : '#d8dee9', fontWeight: 600 }}>
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
                  background: skill.isActive !== false ? '#88c0d0' : '#4c566a',
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
            background: '#2e3440',
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
              <h2 style={{ margin: 0, color: '#eceff4', fontSize: '1.25rem' }}>DANGER ZONE: System Access</h2>
            </div>
            
            <p style={{ color: '#d8dee9', lineHeight: '1.6', marginBottom: '24px' }}>
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
                  border: '1px solid #4c566a',
                  color: '#d8dee9',
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
                  color: '#eceff4',
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
