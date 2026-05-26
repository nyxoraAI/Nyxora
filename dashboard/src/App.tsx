import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Terminal, Activity, MessageSquare, LayoutDashboard, Settings as SettingsIcon, Compass, Database } from 'lucide-react';
import Overview from './Overview';
import Memory from './Memory';
import Settings from './Settings';
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
  const [currentView, setCurrentView] = useState<'chat' | 'overview' | 'memory' | 'settings'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/history');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch config', err);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      await fetchHistory();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <Bot size={32} color="#3b82f6" />
          <div className="sidebar-title">OpenWeb</div>
        </div>

        <div className="sidebar-section">CHAT</div>
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentView('chat')}
          >
            <MessageSquare size={18} /> Chat
          </div>
        </nav>

        <div className="sidebar-section">CONTROL</div>
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
            onClick={() => setCurrentView('overview')}
          >
            <LayoutDashboard size={18} /> Overview
          </div>
          <div 
            className={`nav-item ${currentView === 'memory' ? 'active' : ''}`}
            onClick={() => setCurrentView('memory')}
          >
            <Database size={18} /> Memory
          </div>
          <div 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <SettingsIcon size={18} /> Settings
          </div>
        </nav>

        <div className="sidebar-section">AGENT</div>
        <nav className="sidebar-nav">
          <div className="nav-item">
            <Compass size={18} /> Skills
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <span>OpenWeb</span>
            <span style={{color: '#3b82f6'}}>•</span>
            <span style={{color: '#fff'}}>Chat</span>
          </div>
          
          <div className="topbar-right">
            {config && (
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
        ) : currentView === 'memory' ? (
          <Memory />
        ) : currentView === 'settings' ? (
          <Settings config={config} onConfigChange={setConfig} />
        ) : (
          <div className="chat-wrapper">
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
              <input
                type="text"
                className="chat-input"
                placeholder="Message OpenWeb Agent (Enter to send)..."
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
        )}
      </main>
    </>
  );
}

export default App;
