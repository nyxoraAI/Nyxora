import { apiFetch } from './utils/api';
import { useState, useEffect, useRef } from 'react';
import { Play, Square, Settings as SettingsIcon, Brain, Cpu, MessageSquare, Plus, Trash2, Code, Shield, Network, Terminal, RefreshCw, Send, Image as ImageIcon, Sparkles, Edit2, Zap, ArrowRight, Wallet, Check, AlertTriangle, Bot, Activity, Database, Mic, Copy, Search, LayoutDashboard, Key, Server, Sun, Moon, Monitor, PanelLeftClose, PanelLeftOpen, Paperclip } from 'lucide-react';
import Overview from './Overview';
import Settings from './Settings';
import Skills from './Skills';
import OsSkills from './OsSkills';
import { DefiKeys } from './DefiKeys';
import { MarketOracles } from './MarketOracles';
import SearchChat from './SearchChat';
import RpcConfig from './RpcConfig';
import { Portfolio } from './Portfolio';
import { NetworkSelector } from './NetworkSelector';
import { RouterSelector } from './RouterSelector';
import PendingTransactions from './PendingTransactions';
import BalanceWidget from './BalanceWidget';
import MarketWidget from './MarketWidget';
import NyxoraLogo from './NyxoraLogo';
import SwapWidget from './SwapWidget';
import ReconnectOverlay from './components/ReconnectOverlay';
import './index.css';

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  tool_calls?: any[];
}

interface Config {
  agent: { name: string; default_chain: string; default_router?: string };
  llm: { provider: string; model: string; temperature: number };
}

function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'overview' | 'portfolio' | 'settings' | 'skills' | 'osskills' | 'defikeys' | 'marketoracles' | 'rpcconfig' | 'search'>(() => {
    return (localStorage.getItem('nyxora_current_view') as any) || 'chat';
  });
  const [trendingTokens, setTrendingTokens] = useState<string[]>(['$BTC', '$ETH', '$SOL', '$SUI']);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('nyxora_active_session_id') || null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionTitle, setEditSessionTitle] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const isVoiceModeRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [chatWidth, setChatWidth] = useState(70);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<number>(0);
  const lastActivityRef = useRef<number>(0);
  const [autoLockTime, setAutoLockTime] = useState<number>(() => parseInt(localStorage.getItem('nyxora_auto_lock') || '0'));

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>(() => (localStorage.getItem('nyxora_theme') as 'dark' | 'light' | 'auto') || 'auto');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('nyxora_sidebar_collapsed') === 'true');

  useEffect(() => {
    localStorage.setItem('nyxora_current_view', currentView);
  }, [currentView]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('nyxora_active_session_id', activeSessionId);
    } else {
      localStorage.removeItem('nyxora_active_session_id');
    }
  }, [activeSessionId]);

  useEffect(() => {
    const applyTheme = (currentTheme: 'dark' | 'light' | 'auto') => {
      if (currentTheme === 'auto') {
        const isSystemLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        if (isSystemLight) {
          document.body.classList.add('light-theme');
        } else {
          document.body.classList.remove('light-theme');
        }
      } else if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    };

    applyTheme(theme);
    localStorage.setItem('nyxora_theme', theme);

    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handler = () => applyTheme('auto');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('nyxora_sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    const handleActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  useEffect(() => {
    const lockCheck = setInterval(() => {
      if (autoLockTime > 0 && !isLocked && (Date.now() - lastActivityRef.current > autoLockTime * 60 * 1000)) {
        setIsLocked(true);
        setLockedAt(Date.now());
      }
    }, 1000);
    return () => clearInterval(lockCheck);
  }, [autoLockTime, isLocked]);

  useEffect(() => {
    let unlockCheck: NodeJS.Timeout;
    if (isLocked) {
      unlockCheck = setInterval(async () => {
        try {
          const res = await apiFetch('/api/status/lock');
          const data = await res.json();
          if (data.lastUnlockRequest && data.lastUnlockRequest > lockedAt) {
            setIsLocked(false);
            lastActivityRef.current = Date.now();
          }
        } catch(e) {}
      }, 1000);
    }
    return () => clearInterval(unlockCheck);
  }, [isLocked, lockedAt]);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = () => {
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch (e) {}
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    // Clean markdown before speaking
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID';
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-listen if in voice mode
      if (isVoiceModeRef.current) {
        startListening();
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceMode = () => {
    const newMode = !isVoiceMode;
    setIsVoiceMode(newMode);
    isVoiceModeRef.current = newMode;
    
    if (newMode) {
      startListening();
    } else {
      recognitionRef.current?.stop();
      setIsListening(false);
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const prompt = `Tolong analisis dokumen ini: ${data.filePath}`;
        handleSend(null as any, prompt);
      } else {
        console.error('File upload failed');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error uploading file', err);
      setIsLoading(false);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fetchHistory = async () => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    try {
      const url = `/api/history?session_id=${activeSessionId}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.warn('Backend not ready, retrying history fetch in 2s...');
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await apiFetch(`/api/sessions`);
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data);
        // On first load, if no active session, auto-select the most recent one
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id);
        }
      }
    } catch (err) {}
  };

  const fetchTrendingTokens = async () => {
    try {
      const res = await apiFetch(`/api/trending`);
      if (res.ok) {
        setTrendingTokens(await res.json());
      }
    } catch (err) {}
  };

  const createNewSession = async () => {
    try {
      const res = await apiFetch(`/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' })
      });
      if (res.ok) {
        const { id } = await res.json();
        setActiveSessionId(id);
        setMessages([]);
        await fetchSessions();
        setCurrentView('chat');
      }
    } catch (err) {}
  };

  const renameSession = async (id: string, newTitle: string) => {
    try {
      await apiFetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      setEditingSessionId(null);
      await fetchSessions();
    } catch (err) {}
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
      await fetchSessions();
    } catch (err) {}
  };

  const fetchConfig = async () => {
    try {
      const res = await apiFetch(`/api/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        setTimeout(fetchConfig, 2000);
      }
    } catch (err) {
      console.warn('Backend not ready, retrying config fetch in 2s...');
      setTimeout(fetchConfig, 2000);
    }
  };

  const updateConfig = async (newConfig: Config) => {
    setConfig(newConfig);
    try {
      await apiFetch(`/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (err) {
      console.error('Failed to save config', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchConfig();
    fetchSessions();
    fetchTrendingTokens();
    const interval = setInterval(() => {
      fetchHistory();
      fetchSessions();
      fetchTrendingTokens();
    }, 2000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  useEffect(() => {
    // Adding a slight timeout to ensure DOM is fully rendered before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);
  }, [messages.length, isLoading, currentView]);

  const handleSend = async (e: React.FormEvent, customMsg?: string) => {
    e?.preventDefault();
    const userMsg = customMsg || input;
    if (!userMsg.trim() || isLoading) return;

    setInput('');
    setIsLoading(true);

    let currentSessionId = activeSessionId;

    // Auto-create session if null
    if (!currentSessionId) {
      try {
        const title = userMsg.length > 25 ? userMsg.substring(0, 25) + '...' : userMsg;
        const res = await apiFetch(`/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        if (res.ok) {
          const { id } = await res.json();
          currentSessionId = id;
          setActiveSessionId(id);
          await fetchSessions();
        }
      } catch (err) {
        console.error("Failed to auto-create session", err);
      }
    }

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const res = await apiFetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, session_id: currentSessionId }),
      });
      const data = await res.json();
      await fetchHistory();

      // Auto-rename on first prompt
      if (messages.length === 0 && currentSessionId) {
        const autoTitle = userMsg.length > 25 ? userMsg.substring(0, 25) + '...' : userMsg;
        renameSession(currentSessionId, autoTitle);
      }

      // Trigger TTS if in voice mode
      if (isVoiceModeRef.current && data.response) {
        speak(data.response);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine active widget for Canvas based on the latest tool call result
  let activeWidget: React.ReactNode = null;
  const latestToolMessage = [...messages].reverse().find(m => m.role === 'tool');
  
  if (latestToolMessage && latestToolMessage.name) {
    if (latestToolMessage.name === 'get_balance') {
      activeWidget = <BalanceWidget data={latestToolMessage.content} />;
    } else if (['analyze_market'].includes(latestToolMessage.name)) {
      activeWidget = <MarketWidget data={latestToolMessage.content} />;
    } else if (latestToolMessage.name === 'swap_token') {
      if (!latestToolMessage.content.startsWith('Failed') && !latestToolMessage.content.startsWith('Error')) {
        activeWidget = <SwapWidget data={latestToolMessage.content} />;
      }
    }
  }
  
  const renderMessageContent = (content: string) => {
    const cleanContent = content.replace(/(?:```(?:xml|html)?\s*)?<think>[\s\S]*?<\/think>(?:\s*```)?|```think[\s\S]*?```/gi, '').trim();

    const parseBold = (text: string) => {
      return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cleanContent && (
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {parseBold(cleanContent)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <ReconnectOverlay />
      {isLocked && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          fontFamily: 'sans-serif'
        }}>
          <Shield size={64} color="var(--accent)" style={{ marginBottom: '20px' }} />
          <h1 style={{ fontSize: '2rem', marginBottom: '10px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Session Locked</h1>
          <p style={{ color: '#e2e8f0', fontSize: '1.2rem', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
            Please open your terminal and run <code>nyxora unlock</code> to authorize unlock.
          </p>
        </div>
      )}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="agent-identity-card" style={{ position: 'relative' }}>
          <div className="agent-avatar">
            <NyxoraLogo size={48} />
          </div>
          <div className="agent-info">
            <div className="agent-name">Nyxora AI</div>
            <div className="agent-status">
              <span className="status-dot"></span> ONLINE
                </div>
          </div>
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={isSidebarCollapsed ? {
              position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '8px'
            } : { 
              position: 'absolute', top: '24px', right: '12px', background: 'transparent', 
              border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' 
            }}
          >
            {isSidebarCollapsed ? <NyxoraLogo size={32} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className="sidebar-scroll-area">
          <nav className="sidebar-nav" style={{ paddingTop: '16px' }}>
            <div 
              className="nav-item"
              onClick={createNewSession}
              title={isSidebarCollapsed ? "New Chat" : undefined}
            >
              <Plus size={15} className="nav-icon" /> <span className="nav-label">New Chat</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
              onClick={() => setCurrentView('search')}
              title={isSidebarCollapsed ? "Search Chat" : undefined}
            >
              <Search size={15} className="nav-icon" /> <span className="nav-label">Search Chat</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
              onClick={() => setCurrentView('overview')}
              title={isSidebarCollapsed ? "Overview" : undefined}
            >
              <LayoutDashboard size={15} className="nav-icon" /> <span className="nav-label">Overview</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'portfolio' ? 'active' : ''}`}
              onClick={() => setCurrentView('portfolio')}
              title={isSidebarCollapsed ? "Portfolio" : undefined}
            >
              <Wallet size={15} className="nav-icon" /> <span className="nav-label">Portfolio</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'skills' ? 'active' : ''}`}
              onClick={() => setCurrentView('skills')}
              title={isSidebarCollapsed ? "Web3 Skills" : undefined}
            >
              <Zap size={15} className="nav-icon" /> <span className="nav-label">Web3 Skills</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'osskills' ? 'active' : ''}`}
              onClick={() => setCurrentView('osskills')}
              title={isSidebarCollapsed ? "OS Skills" : undefined}
            >
              <Terminal size={15} className="nav-icon" /> <span className="nav-label">OS Skills</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'rpcconfig' ? 'active' : ''}`}
              onClick={() => setCurrentView('rpcconfig')}
              title={isSidebarCollapsed ? "RPC Configuration" : undefined}
            >
              <Server size={15} className="nav-icon" /> <span className="nav-label">RPC Configuration</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'defikeys' ? 'active' : ''}`}
              onClick={() => setCurrentView('defikeys')}
              title={isSidebarCollapsed ? "DeFi Configuration" : undefined}
            >
              <Key size={15} className="nav-icon" /> <span className="nav-label">DeFi Configuration</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'marketoracles' ? 'active' : ''}`}
              onClick={() => setCurrentView('marketoracles')}
              title={isSidebarCollapsed ? "Market Oracles" : undefined}
            >
              <Database size={15} className="nav-icon" /> <span className="nav-label">Market Oracles</span>
            </div>
            <div 
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentView('settings')}
              title={isSidebarCollapsed ? "Settings" : undefined}
            >
              <SettingsIcon size={15} className="nav-icon" /> <span className="nav-label">Settings</span>
            </div>
          </nav>
          
          <div className="sidebar-section">
            <span>Recent</span>
          </div>
          <nav className="sidebar-nav sessions-list">
            {chatSessions.map((session) => (
              <div 
                key={session.id}
                className={`nav-item session-item ${activeSessionId === session.id && currentView === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setCurrentView('chat');
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                  <MessageSquare size={14} className="nav-icon" />
                  <span className="nav-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{session.title}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="delete-session-btn" onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditSessionTitle(session.title); }} title="Rename Session">
                    <Edit2 size={12} />
                  </button>
                  <button className="delete-session-btn" onClick={(e) => deleteSession(session.id, e)} title="Delete Session">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <span>Nyxora</span>
            <span style={{color: '#3b82f6'}}>•</span>
            <span style={{color: 'var(--text-primary)', textTransform: 'capitalize'}}>
              {currentView === 'search' ? 'Search Chat' :
               currentView === 'osskills' ? 'OS Skills' : 
               currentView === 'defikeys' ? 'DeFi Configuration' : 
               currentView === 'marketoracles' ? 'Market Oracles' : 
               currentView === 'rpcconfig' ? 'RPC Configuration' : 
               currentView === 'skills' ? 'Web3 Skills' : 
               currentView}
            </span>
          </div>
          
          <div className="topbar-right">
              <button 
                className="network-selector-pill" 
                style={{ padding: '8px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', width: '38px', height: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                onClick={() => {
                  if (theme === 'dark') setTheme('light');
                  else if (theme === 'light') setTheme('auto');
                  else setTheme('dark');
                }}
                title={`Toggle Theme (Current: ${theme})`}
              >
                {theme === 'dark' && <Moon size={18} />}
                {theme === 'light' && <Sun size={18} />}
                {theme === 'auto' && <Monitor size={18} />}
              </button>

            {!config ? (
              <span style={{ color: '#f59e0b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="dot" style={{ background: '#f59e0b', animation: 'pulse 1s infinite' }}></span> Waiting for API Gateway...
              </span>
            ) : (
              <>
                <NetworkSelector 
                  value={config.agent.default_chain} 
                  onChange={(chain) => updateConfig({ ...config, agent: { ...config.agent, default_chain: chain }})} 
                  showAllOption={true}
                />
                <RouterSelector 
                  value={config.agent.default_router || 'auto'} 
                  onChange={(router) => updateConfig({ ...config, agent: { ...config.agent, default_router: router }})} 
                />
              </>
            )}
          </div>
        </header>

        {currentView === 'search' ? (
          <SearchChat chatSessions={chatSessions} onSelectSession={(id) => { setActiveSessionId(id); setCurrentView('chat'); }} />
        ) : currentView === 'overview' ? (
          <Overview config={config} sessionsCount={chatSessions.length} />
        ) : currentView === 'portfolio' ? (
          <Portfolio />
        ) : currentView === 'skills' ? (
          <Skills />
        ) : currentView === 'osskills' ? (
          <OsSkills />
        ) : currentView === 'settings' ? (
          <Settings config={config} onConfigChange={setConfig} autoLockTime={autoLockTime} setAutoLockTime={(val: number) => { setAutoLockTime(val); localStorage.setItem('nyxora_auto_lock', val.toString()); }} />
        ) : currentView === 'rpcconfig' ? (
          <RpcConfig />
        ) : currentView === 'defikeys' ? (
          <DefiKeys />
        ) : currentView === 'marketoracles' ? (
          <MarketOracles />
        ) : (
          <div className="workspace-container">
            <div className="chat-wrapper" style={{ width: '100%', margin: '0 auto', maxWidth: '1000px' }}>
              <div className="chat-container">
              {messages.map((msg, idx) => {
              const handleCopy = () => {
                navigator.clipboard.writeText(msg.content);
                setCopiedIndex(idx);
                setTimeout(() => setCopiedIndex(null), 2000);
              };

              if (msg.role === 'user') {
                return (
                  <div key={idx} className="message-wrapper user">
                    <div className="message-bubble">{msg.content}</div>
                    <button className="copy-btn" onClick={handleCopy} title="Copy message">
                      {copiedIndex === idx ? <Check size={14} color="#a3be8c" /> : <Copy size={14} />}
                    </button>
                  </div>
                );
              }
              if (msg.role === 'assistant' && (msg.content || msg.tool_calls)) {
                return (
                  <div key={idx} className="message-wrapper agent">
                    {msg.content && (
                      <>
                        <div className="message-bubble">{renderMessageContent(msg.content)}</div>
                        <button className="copy-btn" onClick={handleCopy} title="Copy message">
                          {copiedIndex === idx ? <Check size={14} color="#a3be8c" /> : <Copy size={14} />}
                        </button>
                      </>
                    )}
                    {msg.tool_calls && msg.tool_calls.map((tool: any, tIdx: number) => (
                      <div key={`t-${tIdx}`} className="tool-call">
                        <Activity size={16} color="#22c55e" />
                        Executing: <code>{tool.function.name}</code>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            })}

            {isLoading && (
              <div className="typing-indicator">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            )}
            {activeWidget && (
              <div className="widget-container-live" style={{ marginTop: '16px', marginBottom: '16px' }}>
                {activeWidget}
              </div>
            )}
            <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <form className="input-form" onSubmit={handleSend}>
                <div className="action-menu-container">
                  <button type="button" className="voice-button plus-button" disabled={isLoading} title="More Actions">
                    <Plus size={20} />
                  </button>
                  <div className="action-menu-items">
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                    <button type="button" className="voice-button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} title="Upload Document" style={{ color: 'var(--text-secondary)' }}>
                      <Paperclip size={18} />
                    </button>
                    <button type="button" className={`voice-button ${isVoiceMode ? 'active pulse' : ''}`} onClick={toggleVoiceMode} title={isVoiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}>
                      <Mic size={18} color={isVoiceMode ? 'var(--accent)' : 'currentColor'} />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="chat-input"
                  placeholder={isVoiceMode ? "Listening..." : "Message Nyxora Agent (Enter to send)..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                />
                <button type="submit" className="send-button" disabled={isLoading || !input.trim()}>
                  <Send size={20} />
                </button>
              </form>
              <div className="trending-tokens">
                <span>Trending Tokens:</span>
                {trendingTokens.map((token, idx) => (
                  <span 
                    key={idx} 
                    className="token-tag" 
                    onClick={() => setInput(`Tolong berikan analisis pasar terbaru untuk ${token}`)}
                    title={`Click to analyze ${token}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}
        <PendingTransactions sessionId={activeSessionId} />
      </main>

      {editingSessionId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e1e24', borderRadius: '16px', padding: '24px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#e2e8f0', fontWeight: 500 }}>Rename this chat</h3>
            <input 
              type="text" 
              value={editSessionTitle}
              onChange={(e) => setEditSessionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameSession(editingSessionId, editSessionTitle);
                if (e.key === 'Escape') setEditingSessionId(null);
              }}
              autoFocus
              style={{ width: '100%', background: 'transparent', color: 'var(--text-primary)', border: '1px solid #3f4451', borderRadius: '8px', padding: '14px 16px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = '#3f4451'}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button 
                onClick={() => setEditingSessionId(null)}
                style={{ background: 'transparent', border: 'none', color: '#a0aec0', cursor: 'pointer', padding: '10px 20px', borderRadius: '24px', fontWeight: 500, fontSize: '0.9rem' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button 
                onClick={() => renameSession(editingSessionId, editSessionTitle)}
                style={{ background: 'var(--accent)', border: 'none', color: '#13131a', cursor: 'pointer', padding: '10px 20px', borderRadius: '24px', fontWeight: 600, fontSize: '0.9rem' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
