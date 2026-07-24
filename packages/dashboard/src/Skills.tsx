import React, { useState, useEffect } from 'react';
import {
  Search, Wallet, Send, Zap, ArrowRightLeft, RefreshCw, Image, Terminal,
  User, Shield, PieChart, LineChart, Flame, Lock, Droplet, Target, Compass,
  WalletCards, Landmark, Vault, Globe, FileText, Monitor, Brain, Database,
  Bot, Code, Music, Download, MessageSquare, Calendar, Scissors, Mail,
  Cpu, HardDrive, FolderSearch, Clock
} from 'lucide-react';
import { apiFetch } from './utils/api';

interface SkillDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters?: { properties?: Record<string, any>; required?: string[] };
  };
  isActive?: boolean;
}

const formatSkillName = (name: string) =>
  name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getWeb3Icon = (skillName: string, active: boolean) => {
  const color = active ? 'var(--accent)' : 'var(--text-secondary)';
  const size = 20;
  switch (formatSkillName(skillName).toLowerCase()) {
    case 'get balance': return <Wallet size={size} color={color} />;
    case 'transfer token': return <Send size={size} color={color} />;
    case 'get price': return <Zap size={size} color={color} />;
    case 'swap token': return <ArrowRightLeft size={size} color={color} />;
    case 'bridge token': return <RefreshCw size={size} color={color} />;
    case 'mint nft': return <Image size={size} color={color} />;
    case 'custom tx': return <Terminal size={size} color={color} />;
    case 'get my address': return <User size={size} color={color} />;
    case 'check token security': return <Shield size={size} color={color} />;
    case 'check portfolio': return <PieChart size={size} color={color} />;
    case 'analyze market': return <LineChart size={size} color={color} />;
    case 'get trending tokens': return <Flame size={size} color={color} />;
    case 'create wallet': return <WalletCards size={size} color={color} />;
    case 'supply aave': return <Landmark size={size} color={color} />;
    case 'revoke approval': return <Lock size={size} color={color} />;
    case 'deposit yield vault': return <Vault size={size} color={color} />;
    case 'provide liquidity v3': return <Droplet size={size} color={color} />;
    case 'create limit order': return <Target size={size} color={color} />;
    default: return <Compass size={size} color={color} />;
  }
};

const getOsIcon = (skillName: string, active: boolean) => {
  const color = active ? 'var(--accent)' : 'var(--text-secondary)';
  const size = 20;
  const n = skillName.toLowerCase();
  if (n.includes('browse') || n.includes('web')) return <Globe size={size} color={color} />;
  if (n.includes('read_file') || n.includes('file')) return <FileText size={size} color={color} />;
  if (n.includes('shell') || n.includes('execute')) return <Terminal size={size} color={color} />;
  if (n.includes('computer') || n.includes('screen')) return <Monitor size={size} color={color} />;
  if (n.includes('memory') || n.includes('forget')) return <Brain size={size} color={color} />;
  if (n.includes('image') || n.includes('photo')) return <Image size={size} color={color} />;
  if (n.includes('audio') || n.includes('transcribe')) return <Music size={size} color={color} />;
  if (n.includes('download')) return <Download size={size} color={color} />;
  if (n.includes('telegram') || n.includes('chat')) return <MessageSquare size={size} color={color} />;
  if (n.includes('schedule') || n.includes('cron')) return <Clock size={size} color={color} />;
  if (n.includes('cancel')) return <Scissors size={size} color={color} />;
  if (n.includes('excel') || n.includes('spreadsheet')) return <Database size={size} color={color} />;
  if (n.includes('google') || n.includes('gmail') || n.includes('mail')) return <Mail size={size} color={color} />;
  if (n.includes('subagent') || n.includes('delegate')) return <Bot size={size} color={color} />;
  if (n.includes('skill') || n.includes('cognitive')) return <Code size={size} color={color} />;
  if (n.includes('search')) return <FolderSearch size={size} color={color} />;
  if (n.includes('playbook')) return <Calendar size={size} color={color} />;
  if (n.includes('summary') || n.includes('summarize')) return <Scissors size={size} color={color} />;
  return <Cpu size={size} color={color} />;
};

const SkillRow: React.FC<{
  skill: SkillDefinition;
  onToggle: (name: string, current: boolean) => void;
  iconFn: (name: string, active: boolean) => React.ReactNode;
  accentColor: string;
}> = ({ skill, onToggle, iconFn, accentColor }) => {
  const active = skill.isActive !== false;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-secondary)', padding: '16px 20px',
        border: '1px solid var(--glass-border)', borderRadius: '8px',
        transition: 'border-color 0.2s', opacity: active ? 1 : 0.6
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = active ? accentColor : 'var(--glass-border)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
        <div style={{ marginTop: '2px', flexShrink: 0 }}>{iconFn(skill.function.name, active)}</div>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
            {formatSkillName(skill.function.name)}
          </h3>
          <p style={{
            margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {skill.function.description}
          </p>
        </div>
      </div>
      <div style={{ marginLeft: '20px', flexShrink: 0 }}>
        <button
          onClick={() => onToggle(skill.function.name, active)}
          style={{
            position: 'relative', width: '40px', height: '22px',
            borderRadius: '11px', background: active ? accentColor : 'var(--glass-border)',
            border: 'none', cursor: 'pointer', transition: 'background 0.3s ease', padding: 0
          }}
        >
          <div style={{
            position: 'absolute', top: '2px',
            left: active ? '20px' : '2px', width: '18px', height: '18px',
            borderRadius: '50%', background: '#fff',
            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
          }} />
        </button>
      </div>
    </div>
  );
};

const Skills: React.FC = () => {
  const [web3Skills, setWeb3Skills] = useState<SkillDefinition[]>([]);
  const [osSkills, setOsSkills] = useState<SkillDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'web3' | 'os'>('web3');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [web3Res, osRes] = await Promise.all([
          apiFetch('/api/skills'),
          apiFetch('/api/skills/system')
        ]);
        if (web3Res.ok) setWeb3Skills(await web3Res.json());
        if (osRes.ok) setOsSkills(await osRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleToggle = async (name: string, current: boolean) => {
    const newStatus = !current;
    const setter = tab === 'web3' ? setWeb3Skills : setOsSkills;
    setter(prev => prev.map(s => s.function.name === name ? { ...s, isActive: newStatus } : s));
    try {
      await apiFetch('/api/skills/toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: name, active: newStatus })
      });
    } catch {
      setter(prev => prev.map(s => s.function.name === name ? { ...s, isActive: current } : s));
    }
  };

  const activeList = tab === 'web3' ? web3Skills : osSkills;
  const filtered = activeList.filter(s =>
    s.function.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.function.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const web3Active = web3Skills.filter(s => s.isActive !== false).length;
  const osActive = osSkills.filter(s => s.isActive !== false).length;

  return (
    <div className="overview-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }}>
          <Terminal size={24} color="var(--accent)" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Skills</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Enable or disable individual agent capabilities
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px 20px', flex: 1 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>WEB3 SKILLS</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 700 }}>{web3Active} <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 400 }}>/ {web3Skills.length} active</span></div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px 20px', flex: 1 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>OS / SYSTEM SKILLS</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 700 }}>{osActive} <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 400 }}>/ {osSkills.length} active</span></div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            onClick={() => setTab('web3')}
            style={{
              padding: '8px 18px', background: tab === 'web3' ? 'var(--accent)' : 'transparent',
              color: tab === 'web3' ? 'var(--accent-text)' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
              letterSpacing: '0.04em', transition: 'all 0.2s'
            }}
          >
            ⛓ WEB3
          </button>
          <button
            onClick={() => setTab('os')}
            style={{
              padding: '8px 18px', background: tab === 'os' ? 'var(--accent)' : 'transparent',
              color: tab === 'os' ? 'var(--accent-text)' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
              letterSpacing: '0.04em', transition: 'all 0.2s'
            }}
          >
            💻 OS / SYSTEM
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0 12px' }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder={`Filter ${tab === 'web3' ? 'web3' : 'OS'} skills...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', padding: '10px 12px', flex: 1, fontSize: '0.875rem' }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flexShrink: 0 }}>{filtered.length} shown</span>
        </div>
      </div>

      {/* Skill List */}
      {isLoading ? (
        <div style={{ color: 'var(--text-secondary)', padding: '40px', textAlign: 'center' }}>Loading skills...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>No skills found.</div>
          )}
          {filtered.map((skill, i) => (
            <SkillRow
              key={i}
              skill={skill}
              onToggle={handleToggle}
              iconFn={tab === 'web3' ? getWeb3Icon : getOsIcon}
              accentColor="var(--accent)"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Skills;
