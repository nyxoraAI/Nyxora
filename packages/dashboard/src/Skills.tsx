import { apiFetch } from './utils/api';
import React, { useState, useEffect } from 'react';
import { Compass, Search, Wallet, Send, Zap, ArrowRightLeft, RefreshCw, Image, Terminal, MapPin, User, Shield, PieChart, LineChart, WalletCards, Target, ListOrdered, XCircle } from 'lucide-react';

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
  const color = isActive !== false ? "#88c0d0" : "#4c566a";
  const size = 20;
  switch (formatSkillName(skillName).toLowerCase()) {
    case 'get balance': return <Wallet size={size} color={color} />;
    case 'transfer token': return <Send size={size} color={color} />;
    case 'get price': return <Zap size={size} color={color} />;
    case 'swap token': return <ArrowRightLeft size={size} color={color} />;
    case 'bridge token': return <RefreshCw size={size} color={color} />;
    case 'mint nft': return <Image size={size} color={color} />;
    case 'custom tx': return <Terminal size={size} color={color} />;
    case 'check address': return <Search size={size} color={color} />;
    case 'get my address': return <User size={size} color={color} />;
    case 'check token security': return <Shield size={size} color={color} />;
    case 'check portfolio': return <PieChart size={size} color={color} />;
    case 'analyze market': return <LineChart size={size} color={color} />;
    case 'create wallet': return <WalletCards size={size} color={color} />;
    case 'create limit order': return <Target size={size} color={color} />;
    case 'list limit orders': return <ListOrdered size={size} color={color} />;
    case 'cancel limit order': return <XCircle size={size} color={color} />;
    default: return <Compass size={size} color={color} />;
  }
};

const Skills: React.FC = () => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await apiFetch('/api/skills');
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

  if (isLoading) return <div className="overview-container">Loading skills...</div>;

  const filteredSkills = skills.filter(skill => 
    skill.function.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.function.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="overview-container" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div className="overview-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#eceff4' }}>Skills</h1>
        <p style={{ color: '#d8dee9' }}>Installed skills and their status.</p>
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
          placeholder="Filter installed skills..." 
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
    </div>
  );
};

export default Skills;
