import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Plug, Compass, Search, Terminal, Zap, ArrowRightLeft, RefreshCw, Image, MapPin, User, Shield, PieChart, LineChart, WalletCards, Target, Droplet, Lock, Vault, Landmark, Flame, Send, Wallet } from 'lucide-react';

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
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getSkillIcon = (skillName: string, isActive: boolean) => {
  const color = isActive !== false ? "var(--accent)" : "var(--tool-bg)";
  const size = 20;
  return <Plug size={size} color={color} />;
};

const ExternalSkills: React.FC = () => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await apiFetch('/api/skills/external');
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
      console.error('Failed to toggle skill', e);
    }
  };

  if (isLoading) return <div className="settings-subpanel">Loading skills...</div>;

  const filteredSkills = skills.filter(skill => 
    skill.function.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.function.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="settings-subpanel">
      <div className="overview-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text-primary)' }}>External Skills</h1>
        <p style={{ color: 'var(--text-secondary)' }}>User-installed third-party agent skills and custom integrations.</p>
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
          placeholder="Filter installed external skills..." 
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
    </div>
  );
};

export default ExternalSkills;
