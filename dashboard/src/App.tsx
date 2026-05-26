import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Terminal, Activity, MessageSquare, LayoutDashboard, Settings as SettingsIcon, Compass, Database, Mic } from 'lucide-react';
import Overview from './Overview';
import Memory from './Memory';
import Settings from './Settings';
import Skills from './Skills';
import BalanceWidget from './BalanceWidget';
import TransactionWidget from './TransactionWidget';
import MarketWidget from './MarketWidget';
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
  const [currentView, setCurrentView] = useState<'chat' | 'overview' | 'memory' | 'settings' | 'skills'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const isVoiceModeRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [chatWidth, setChatWidth] = useState(70);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Attach them to document only when dragging is active
    // We will attach them in handleMouseDown
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      if (newWidth > 25 && newWidth < 75) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
    try {
      const res = await fetch('http://localhost:3000/api/history');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else {
        setTimeout(fetchHistory, 2000);
      }
    } catch (err) {
      console.warn('Backend not ready, retrying history fetch in 2s...');
      setTimeout(fetchHistory, 2000);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/config');
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
      await fetch('http://localhost:3000/api/config', {
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
  }, []);

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

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      await fetchHistory();

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

  return (
    <>
      <aside className="sidebar">
        <div className="agent-identity-card">
          <div className="agent-avatar">
            <Bot size={28} color="#3b82f6" />
          </div>
          <div className="agent-info">
            <div className="agent-name">Nyxora AI</div>
            <div className="agent-status">
              <span className="status-dot"></span> ONLINE
            </div>
          </div>
        </div>

        <div className="sidebar-scroll-area">
          <div className="sidebar-section">WORKSPACE</div>
          <nav className="sidebar-nav">
            <div 
              className={`nav-item ${currentView === 'chat' ? 'active' : ''}`}
              onClick={() => setCurrentView('chat')}
            >
              <MessageSquare size={18} className="nav-icon" /> Chat
            </div>
            <div 
              className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
              onClick={() => setCurrentView('overview')}
            >
              <LayoutDashboard size={18} className="nav-icon" /> Overview
            </div>
          </nav>

          <div className="sidebar-section">KNOWLEDGE</div>
          <nav className="sidebar-nav">
            <div 
              className={`nav-item ${currentView === 'skills' ? 'active' : ''}`}
              onClick={() => setCurrentView('skills')}
            >
              <Compass size={18} className="nav-icon" /> Web3 Skills
            </div>
            <div 
              className={`nav-item ${currentView === 'memory' ? 'active' : ''}`}
              onClick={() => setCurrentView('memory')}
            >
              <Database size={18} className="nav-icon" /> Memory
            </div>
          </nav>

          <div className="sidebar-section">SYSTEM</div>
          <nav className="sidebar-nav">
            <div 
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentView('settings')}
            >
              <SettingsIcon size={18} className="nav-icon" /> Settings
            </div>
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

                <select 
                  className="config-dropdown" 
                  value={config.llm.provider}
                  onChange={(e) => updateConfig({ ...config, llm: { ...config.llm, provider: e.target.value }})}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Local Ollama</option>
                </select>

                <select 
                  className="config-dropdown" 
                  value={config.llm.model}
                  onChange={(e) => updateConfig({ ...config, llm: { ...config.llm, model: e.target.value }})}
                >
                  {config.llm.provider === 'gemini' && <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>}
                  {config.llm.provider === 'gemini' && <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>}
                  {config.llm.provider === 'openai' && <option value="gpt-4o">GPT-4o</option>}
                  {config.llm.provider === 'openai' && <option value="gpt-4o-mini">GPT-4o Mini</option>}
                  {config.llm.provider === 'ollama' && <option value="llama3">Llama 3</option>}
                </select>
              </>
            )}
          </div>
        </header>

        {currentView === 'overview' ? (
          <Overview config={config} />
        ) : currentView === 'skills' ? (
          <Skills />
        ) : currentView === 'memory' ? (
          <Memory />
        ) : currentView === 'settings' ? (
          <Settings config={config} onConfigChange={setConfig} />
        ) : (
          <div className="workspace-container" ref={workspaceRef}>
            <div className="chat-wrapper" style={{ width: `${chatWidth}%` }}>
              <div className="chat-container">
              {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div key={idx} className="message-wrapper user">
                    <div className="message-bubble">{msg.content}</div>
                  </div>
                );
              }
              if (msg.role === 'assistant' && msg.content) {
                return (
                  <div key={idx} className="message-wrapper agent">
                    <div className="message-bubble">{msg.content}</div>
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
              if (msg.role === 'tool') {
                return (
                  <div key={idx} className="message-wrapper agent">
                    <div className="tool-call">
                      <Terminal size={16} color="#a78bfa" />
                      Result: {msg.content.substring(0, 60)}...
                    </div>
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
            </div>
          </div>
          
          <div className="resizer" onMouseDown={handleMouseDown} />

          <div className="canvas-panel">
            <div className="canvas-header">
              <div className="canvas-title">
                <Compass size={16} />
                LIVE CANVAS
              </div>
              <div style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', display: 'inline-block' }}></span>
                A2UI CONNECTED
              </div>
            </div>

            {activeWidget ? (
              <div style={{ marginTop: '24px' }}>
                {activeWidget}
              </div>
            ) : (
              <div className="canvas-empty">
                <LayoutDashboard size={48} color="rgba(255,255,255,0.1)" />
                <p>Awaiting agent interaction...</p>
                <span style={{ fontSize: '0.8rem' }}>Ask the agent to check your balance or make a transfer.</span>
              </div>
            )}
          </div>
        </div>
        )}
      </main>
    </>
  );
}

export default App;
