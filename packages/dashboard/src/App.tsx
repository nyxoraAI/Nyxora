import { apiFetch } from './utils/api';
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Activity, MessageSquare, LayoutDashboard, Settings as SettingsIcon, Zap, Database, Mic, Copy, Check, Plus, Trash2, Search, Edit2 } from 'lucide-react';
import Overview from './Overview';
import Settings from './Settings';
import Skills from './Skills';
import PendingTransactions from './PendingTransactions';
import BalanceWidget from './BalanceWidget';
import TransactionWidget from './TransactionWidget';
import MarketWidget from './MarketWidget';
import NyxoraLogo from './NyxoraLogo';
import SwapWidget from './SwapWidget';
import './index.css';

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  tool_calls?: any[];
}

interface Config {
  agent: { name: string; default_chain: string };
  llm: { provider: string; model: string; temperature: number };
}

function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'overview' | 'settings' | 'skills'>('chat');
  const [trendingTokens, setTrendingTokens] = useState<string[]>(['$BTC', '$ETH', '$SOL', '$SUI']);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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

  useEffect(() => {
    // Scroll to bottom on new message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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

  const fetchHistory = async () => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    try {
      const url = `http://localhost:3000/api/history?session_id=${activeSessionId}`;
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
      const res = await apiFetch('http://localhost:3000/api/sessions');
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
      const res = await apiFetch('http://localhost:3000/api/trending');
      if (res.ok) {
        setTrendingTokens(await res.json());
      }
    } catch (err) {}
  };

  const createNewSession = async () => {
    try {
      const res = await apiFetch('http://localhost:3000/api/sessions', {
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
      await apiFetch(`http://localhost:3000/api/sessions/${id}`, {
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
      await apiFetch(`http://localhost:3000/api/sessions/${id}`, { method: 'DELETE' });
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
      await fetchSessions();
    } catch (err) {}
  };

  const fetchConfig = async () => {
    try {
      const res = await apiFetch('http://localhost:3000/api/config');
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
      await apiFetch('http://localhost:3000/api/config', {
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 10);
  }, [messages, isLoading, currentView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setIsLoading(true);

    let currentSessionId = activeSessionId;

    // Auto-create session if null
    if (!currentSessionId) {
      try {
        const title = userMsg.length > 25 ? userMsg.substring(0, 25) + '...' : userMsg;
        const res = await apiFetch('http://localhost:3000/api/sessions', {
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
      const res = await apiFetch('http://localhost:3000/api/chat', {
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
    } else if (latestToolMessage.name === 'transfer_native') {
      activeWidget = <TransactionWidget data={latestToolMessage.content} />;
    } else if (latestToolMessage.name === 'get_price') {
      activeWidget = <MarketWidget data={latestToolMessage.content} />;
    } else if (latestToolMessage.name === 'swap_token') {
      activeWidget = <SwapWidget data={latestToolMessage.content} />;
    }
  }
  
  const renderMessageContent = (content: string) => {
    return content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      <aside className="sidebar">
        <div className="agent-identity-card">
          <div className="agent-avatar">
            <NyxoraLogo size={48} />
          </div>
          <div className="agent-info">
            <div className="agent-name">Nyxora AI</div>
            <div className="agent-status">
              <span className="status-dot"></span> ONLINE
            </div>
          </div>
        </div>

        <div className="sidebar-scroll-area">
          <nav className="sidebar-nav" style={{ paddingTop: '16px' }}>
            <div 
              className="nav-item"
              onClick={createNewSession}
            >
              <Plus size={15} className="nav-icon" /> New Chat
            </div>
            <div 
              className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
              onClick={() => setCurrentView('overview')}
            >
              <LayoutDashboard size={15} className="nav-icon" /> Overview
            </div>
            <div 
              className={`nav-item ${currentView === 'skills' ? 'active' : ''}`}
              onClick={() => setCurrentView('skills')}
            >
              <Zap size={15} className="nav-icon" /> Web3 Skills
            </div>
            <div 
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentView('settings')}
            >
              <SettingsIcon size={15} className="nav-icon" /> Settings
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
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                    {session.title}
                  </span>
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
            <span style={{color: '#fff'}}>Chat</span>
          </div>
          
          <div className="topbar-right">
            {!config ? (
              <span style={{ color: '#f59e0b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="dot" style={{ background: '#f59e0b', animation: 'pulse 1s infinite' }}></span> Waiting for API Gateway...
              </span>
            ) : (
              <>
                <select 
                  className="config-dropdown" 
                  value={config.agent.default_chain}
                  onChange={(e) => updateConfig({ ...config, agent: { ...config.agent, default_chain: e.target.value }})}
                >
                  <option value="sepolia">Sepolia (Testnet)</option>
                  <option value="base">Base</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="bsc">BNB Smart Chain</option>
                  <option value="arbitrum">Arbitrum</option>
                </select>
              </>
            )}
          </div>
        </header>

        {currentView === 'overview' ? (
          <Overview config={config} />
        ) : currentView === 'skills' ? (
          <Skills />
        ) : currentView === 'settings' ? (
          <Settings config={config} onConfigChange={setConfig} />
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
              if (msg.role === 'assistant' && msg.content) {
                return (
                  <div key={idx} className="message-wrapper agent">
                    <div className="message-bubble">{renderMessageContent(msg.content)}</div>
                    <button className="copy-btn" onClick={handleCopy} title="Copy message">
                      {copiedIndex === idx ? <Check size={14} color="#a3be8c" /> : <Copy size={14} />}
                    </button>
                  </div>
                );
              }
              if (msg.role === 'assistant' && msg.tool_calls) {
                return (
                  <div key={idx} className="message-wrapper agent">
                    {msg.tool_calls.map((tool: any, tIdx: number) => (
                      <div key={tIdx} className="tool-call">
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
            <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <form className="input-form" onSubmit={handleSubmit}>
                <button 
                  type="button" 
                  className={`voice-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''} ${isVoiceMode && !isListening && !isSpeaking ? 'active-mode' : ''}`}
                  onClick={toggleVoiceMode}
                  title={isVoiceMode ? "Disable Voice Mode" : "Enable Hands-Free Voice Mode"}
                >
                  <Mic size={20} />
                </button>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Message Nyxora Agent (Enter to send)..."
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
              style={{ width: '100%', background: 'transparent', color: '#fff', border: '1px solid #3f4451', borderRadius: '8px', padding: '14px 16px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => e.target.style.borderColor = '#88c0d0'}
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
                style={{ background: '#88c0d0', border: 'none', color: '#13131a', cursor: 'pointer', padding: '10px 20px', borderRadius: '24px', fontWeight: 600, fontSize: '0.9rem' }}
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
