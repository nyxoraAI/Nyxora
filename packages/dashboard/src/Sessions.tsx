import React, { useRef, useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Mic, Paperclip, Send, Loader2, Plus, Check, Copy } from 'lucide-react';
import { useChat } from './hooks/useChat';
import NyxoraLogo from './NyxoraLogo';
import { AgentTrace } from './AgentTrace';
import BalanceWidget from './BalanceWidget';
import MarketWidget from './MarketWidget';
import SwapWidget from './SwapWidget';
import PendingTransactions from './PendingTransactions';
import { apiFetch } from './utils/api';

const greetings = [
  { title: "Hello. I'm Nyxora.", desc: "I am a high-autonomy financial agent. Give me a goal, and I will execute it." }
];

export const Sessions: React.FC = () => {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isVoiceModeRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [trendingTokens, setTrendingTokens] = useState<string[]>(['$BTC', '$ETH', '$SOL', '$SUI']);

  const startListening = () => {
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {}
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (isVoiceModeRef.current) startListening();
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

  const {
    messages,
    activeSessionId,
    input,
    setInput,
    isLoading,
    setIsLoading,
    handleSend
  } = useChat(isVoiceMode, speak);

  useEffect(() => {
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
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 10);
  }, [messages, isLoading]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        const prompt = `Please analyze this document: ${data.filePath}`;
        handleSend(null, prompt);
      } else {
        setIsLoading(false);
      }
    } catch {
      setIsLoading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderMessageContent = (content: string) => {
    let cleanContent = content
      .replace(/(?:```(?:xml|html)?\s*)?<think>[\s\S]*?<\/think>(?:\s*```)?|```think[\s\S]*?```/gi, '')
      .replace(/<tool_code>[\s\S]*?<\/tool_code>/gi, '')
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      .replace(/<(?:execute_bash|execute)>[\s\S]*?<\/(?:execute_bash|execute)>/gi, '')
      .replace(/```(?:json)?\s*\[?\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]\s*```|```|$)/gi, '')
      .replace(/\[\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]|$)/gi, '')
      .trim();

    return (
      <div className="markdown-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cleanContent && (
          <div 
            className="markdown-body"
            style={{ overflowWrap: 'anywhere' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(cleanContent) as string) }}
          />
        )}
      </div>
    );
  };

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

  const getMergedMessages = (msgs: any[]) => {
    const merged: any[] = [];
    let currentAssistantMsg: any = null;
    for (const m of msgs) {
      if (m.role === 'user') {
        if (currentAssistantMsg) {
          merged.push(currentAssistantMsg);
          currentAssistantMsg = null;
        }
        merged.push(m);
      } else if (m.role === 'assistant') {
        if (currentAssistantMsg) {
          if (m.tool_calls) currentAssistantMsg.tool_calls = [...(currentAssistantMsg.tool_calls || []), ...m.tool_calls];
          if (m.content && m.content.trim() !== '') {
            if (currentAssistantMsg.tool_calls && currentAssistantMsg.tool_calls.length > 0) {
               currentAssistantMsg.content = m.content.trim();
            } else {
               currentAssistantMsg.content = (currentAssistantMsg.content && currentAssistantMsg.content.trim() !== '')
                 ? currentAssistantMsg.content.trim() + '\n\n' + m.content.trim() 
                 : m.content.trim();
            }
          }
          if (m.reasoning_content) currentAssistantMsg.reasoning_content = (currentAssistantMsg.reasoning_content || '') + m.reasoning_content;
          if (m.progressLogs) currentAssistantMsg.progressLogs = [...(currentAssistantMsg.progressLogs || []), ...m.progressLogs];
          currentAssistantMsg.isStreaming = currentAssistantMsg.isStreaming || m.isStreaming;
        } else {
          currentAssistantMsg = { ...m };
        }
      }
    }
    if (currentAssistantMsg) merged.push(currentAssistantMsg);
    return merged;
  };

  return (
    <div className="workspace-container">
      <div className={`chat-wrapper ${messages.length === 0 ? 'empty-state-wrapper' : ''}`} style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {messages.length === 0 && (
          <div className="empty-state-container" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: 0, animation: 'fadeInUp 0.8s ease-out forwards', textAlign: 'center', marginBottom: '40px'
          }}>
            <div style={{ background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.15) 0%, transparent 70%)', padding: '40px', borderRadius: '50%', marginBottom: '20px' }}>
              <NyxoraLogo size={80} color="var(--accent)" />
            </div>
            <h1 className="empty-state-title" style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '16px', letterSpacing: '-1px' }}>
              {greetings[0].title}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '500px', lineHeight: '1.6' }}>
              {greetings[0].desc}
            </p>
          </div>
        )}

        <div className="chat-container" ref={chatContainerRef} style={{ flexGrow: messages.length === 0 ? 0 : 1, display: messages.length === 0 ? 'none' : 'flex', flexDirection: 'column' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {getMergedMessages(messages).map((msg, idx) => {
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
              if (msg.role === 'assistant' && (msg.content || msg.tool_calls || msg.progressLogs || msg.reasoning_content)) {
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: 'flex-start', maxWidth: '95%' }}>
                    {(msg.tool_calls?.length > 0 || msg.progressLogs?.length > 0) && (
                      <AgentTrace 
                        toolCalls={msg.tool_calls} 
                        progressLogs={msg.progressLogs} 
                        isStreaming={msg.isStreaming} 
                        durationMs={(msg as any).duration_ms}
                      />
                    )}
                    {msg.content && msg.content.trim() !== '' && (
                      <div className="message-wrapper agent" style={{ maxWidth: '100%', margin: 0 }}>
                        <div className="message-bubble">{renderMessageContent(msg.content)}</div>
                        <button className="copy-btn" onClick={handleCopy} title="Copy message">
                          {copiedIndex === idx ? <Check size={14} color="#a3be8c" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}

            {isLoading && !messages.some((m: any) => m.isStreaming && (m.content || m.progressLogs)) && (
              <div className="working-indicator">
                <span className="working-dots">Working</span>
              </div>
            )}
            {activeWidget && (
              <div className="widget-container-live" style={{ marginTop: '16px', marginBottom: '16px' }}>
                {activeWidget}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
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
            <textarea
              className="chat-input styled-scroll"
              placeholder={isVoiceMode ? "Listening..." : "Ask Nyxora"}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(null);
                }
              }}
              disabled={isLoading}
              rows={1}
              style={{ resize: 'none', minHeight: '36px', paddingTop: '10px' }}
            />
            <button type="submit" className="send-button" disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 size={20} className="spinner" /> : <Send size={20} />}
            </button>
          </form>
          <div className="trending-tokens">
            <span>Trending Tokens:</span>
            {trendingTokens.map((token, idx) => (
              <span 
                key={idx} 
                className="token-tag" 
                onClick={() => setInput(`Please provide the latest market analysis for ${token}`)}
                title={`Click to analyze ${token}`}
                style={{ cursor: 'pointer' }}
              >
                {token}
              </span>
            ))}
          </div>
        </div>
      </div>
      <PendingTransactions sessionId={activeSessionId} />
    </div>
  );
};

export default Sessions;
