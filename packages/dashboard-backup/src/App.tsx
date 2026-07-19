import { apiFetch } from './utils/api';
import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Play, Square, Settings as SettingsIcon, Brain, Cpu, MessageSquare, Plus, Trash2, Code, Shield, Network, Terminal, RefreshCw, Send, Image as ImageIcon, Sparkles, Edit2, Zap, ArrowRight, Wallet, Check, AlertTriangle, Bot, Activity, Database, Mic, Copy, Search, LayoutDashboard, Key, Server, Sun, Moon, Monitor, PanelLeftClose, PanelLeftOpen, Paperclip, Loader2, BookOpen, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import Overview from './Overview';
import Settings from './Settings';
import SearchChat from './SearchChat';
import { Portfolio } from './Portfolio';
import { NetworkSelector } from './NetworkSelector';
import { RouterSelector } from './RouterSelector';
import PendingTransactions from './PendingTransactions';
import BalanceWidget from './BalanceWidget';
import MarketWidget from './MarketWidget';
import NyxoraLogo from './NyxoraLogo';
import SwapWidget from './SwapWidget';
import ReconnectOverlay from './components/ReconnectOverlay';
import Login from './Login';

import { usePolling } from './utils/usePolling';
import './index.css';

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  reasoning_content?: string;
  tool_calls?: any[];
  isOptimistic?: boolean;
  isStreaming?: boolean;
  progress?: string;
  id?: string;
}

interface Config {
  agent: { name: string; default_chain: string; default_router?: string; base_fiat?: string; };
  llm: { provider: string; model: string; temperature: number };
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('nyxora_auth') === 'true');
  const [currentView, setCurrentView] = useState<'chat' | 'overview' | 'portfolio' | 'settings' | 'skills' | 'osskills' | 'defikeys' | 'marketoracles' | 'rpcconfig' | 'search' | 'playbooks'>('chat');
  const [trendingTokens, setTrendingTokens] = useState<string[]>(['$BTC', '$ETH', '$SOL', '$SUI']);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether a dual-bubble stream is active — usePolling checks this
  // before calling fetchHistory() to avoid overwriting bubble state.
  const hasBubblesRef = useRef(false);

  // Autofocus the chat input when the LLM finishes responding
  useEffect(() => {
    if (!isLoading) {
      // Use standard DOM query to bypass any Ref mounting race conditions
      setTimeout(() => {
        const textarea = document.querySelector('.chat-input') as HTMLTextAreaElement;
        if (textarea && !textarea.disabled) {
          textarea.focus();
        }
      }, 150);
    }
  }, [isLoading]);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalInput, setAuthModalInput] = useState('');

  // Auto-Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<number>(0);
  const lastActivityRef = useRef<number>(0);
  const [clampedMessages, setClampedMessages] = useState<Record<number, boolean>>({});
  const toggleClamp = (idx: number) => setClampedMessages(prev => ({ ...prev, [idx]: !prev[idx] }));
  const [autoLockTime, setAutoLockTime] = useState<number>(() => parseInt(localStorage.getItem('nyxora_auto_lock') || '0'));

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>(() => (localStorage.getItem('nyxora_theme') as 'dark' | 'light' | 'auto') || 'auto');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('nyxora_sidebar_collapsed') === 'true');


  useEffect(() => {
    document.title = "Nyxora Dashboard";
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
    const handleAuthError = () => {
      setShowAuthModal(true);
    };
    
    // Check initially if token exists
    if (!localStorage.getItem('nyxora_token')) {
      setShowAuthModal(true);
    }

    window.addEventListener('nyxora-auth-error', handleAuthError);
    return () => {
      window.removeEventListener('nyxora-auth-error', handleAuthError);
    };
  }, []);

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
        } catch {}
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
    } catch {}
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    // Clean markdown before speaking
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    
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
        const prompt = `Please analyze this document: ${data.filePath}`;
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
        setMessages(prev => {
          const optimisticMsgs = prev.filter(m => m.isOptimistic);
          const nonOptimisticPrev = prev.filter(m => !m.isOptimistic);
          
          if (JSON.stringify(nonOptimisticPrev) === JSON.stringify(data)) {
            return prev;
          }

          const processedData = data.map((msg: any) => {
            if (msg.role === 'assistant' && msg.content && !msg.reasoning_content) {
              const thinkMatch = msg.content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
              if (thinkMatch) {
                return {
                  ...msg,
                  reasoning_content: thinkMatch[1].trim(),
                  content: msg.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim()
                };
              }
            }
            return msg;
          });

          if (optimisticMsgs.length > 0) {
            const missingOptimistic = optimisticMsgs.filter(opt => !processedData.some((d: any) => d.role === 'user' && d.content === opt.content));
            if (missingOptimistic.length > 0) {
              return [...processedData, ...missingOptimistic];
            }
          }
          return processedData;
        });
      }
    } catch (err) {
      console.warn('Backend not ready, retrying history fetch in 2s...');
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await apiFetch(`/api/sessions?client=dashboard`);
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data);
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id);
        }
      }
    } catch {}
  };

  const fetchProjects = async () => {
    try {
      const res = await apiFetch('/api/projects');
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch {}
  };

  const importProject = async () => {
    try {
      const res = await apiFetch('/api/system/pick-folder');
      if (res.ok) {
        const { path } = await res.json();
        const name = path.split('/').pop() || path;
        await apiFetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, path })
        });
        await fetchProjects();
      }
    } catch {}
  };

  const fetchTrendingTokens = async () => {
    try {
      const res = await apiFetch(`/api/trending`);
      if (res.ok) {
        setTrendingTokens(await res.json());
      }
    } catch {}
  };

  const createNewSession = async (projectId?: string) => {
    try {
      const body: any = { title: 'New Chat', client: 'dashboard' };
      if (projectId) body.project_id = projectId;
      
      const res = await apiFetch(`/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const { id } = await res.json();
        setActiveSessionId(id);
        setMessages([]);
        await fetchSessions();
        setCurrentView('chat');
      }
    } catch {}
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
    } catch {}
  };
  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      await fetchProjects();
      await fetchSessions();
    } catch {}
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
    } catch {}
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
    fetchConfig();
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchSessions();
    fetchProjects();
    fetchTrendingTokens();
  }, [activeSessionId]);

  usePolling(() => {
    // Skip fetchHistory() while a dual-bubble stream is active.
    // If we fetch here, the server returns plain history (no bubble IDs)
    // and overwrites the carefully crafted Bubble A/B state.
    if (!isLoading && !hasBubblesRef.current) {
      fetchHistory();
    }
    fetchSessions();
    fetchProjects();
    fetchTrendingTokens();
  }, 5000);

  useEffect(() => {
    // Adding a slight timeout to ensure DOM is fully rendered before scrolling
    setTimeout(() => {
      const isStreaming = messages.some(m => m.isStreaming);
      if (isStreaming && chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      } else {
        const userMsgEls = document.querySelectorAll('.message-wrapper.user');
        const lastUserMsg = userMsgEls[userMsgEls.length - 1];
        if (lastUserMsg && userMsgEls.length > 1) {
          lastUserMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 50);
  }, [messages, isLoading, currentView]);

  const handleSend = async (e: React.FormEvent, customMsg?: string) => {
    e?.preventDefault();
    const userMsg = customMsg || input;
    if (!userMsg.trim() || isLoading) return;

    setInput('');
    const textarea = document.getElementById('chat-input-textarea');
    if (textarea) textarea.style.height = 'auto';
    setIsLoading(true);

    let currentSessionId = activeSessionId;

    // Auto-create session if null
    if (!currentSessionId) {
      try {
        const title = userMsg.length > 25 ? userMsg.substring(0, 25) + '...' : userMsg;
        const res = await apiFetch(`/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, client: 'dashboard' })
        });
        if (res.ok) {
          const { id } = await res.json();
          currentSessionId = id;
          setActiveSessionId(id);
          await fetchSessions();
        }
      } catch (err) {
        console.error('Failed to auto-create session', err);
      }
    }

    // Add user message optimistically
    setMessages(prev => [...prev, { role: 'user', content: userMsg, isOptimistic: true }]);

    // Add a streaming placeholder for the assistant message (Bubble A)
    const streamingId = `streaming-${Date.now()}`;
    setMessages(prev => [...prev, { role: 'assistant', content: '', reasoning_content: '', id: streamingId, isStreaming: true } as any]);
    hasBubblesRef.current = true; // Prevent usePolling from overwriting bubble state

    let fullResponse = '';
    let renderedResponse = '';
    let intervalId: NodeJS.Timeout | null = null;
    let toolBubbleId: string | null = null;  // Bubble B for tool progress/final
    let hasDetectedToolCall = false;

    try {
      const token = localStorage.getItem('nyxora_token') || '';
      const params = new URLSearchParams({
        message: userMsg,
        session_id: currentSessionId || '',
        token,
      });

      await new Promise<void>((resolve, reject) => {
        const source = new EventSource(`/api/chat/stream?${params}`);
        let isSourceClosed = false;
        let resolvedAlready = false;

        const safeResolve = () => {
          if (!resolvedAlready) {
            resolvedAlready = true;
            if (intervalId) clearInterval(intervalId);
            resolve();
          }
        };

        // Safety timeout: if stream is stuck for more than 90s, force resolve
        const safetyTimeout = setTimeout(() => {
          console.warn('[Dashboard] Stream safety timeout triggered after 90s');
          source.close();
          isSourceClosed = true;
          safeResolve();
        }, 90000);

        // Smooth Markdown rendering buffer (~30 FPS) to prevent React DOM lag
        intervalId = setInterval(() => {
          if (renderedResponse.length < fullResponse.length) {
            // Speed dynamically scales up if buffer gets too large, using natural easing
            const remaining = fullResponse.length - renderedResponse.length;
            const charsPerFrame = Math.max(2, Math.ceil(remaining / 4)); 
            
            const charsToAdd = fullResponse.slice(renderedResponse.length, renderedResponse.length + charsPerFrame);
            renderedResponse += charsToAdd;
            
            // Update the correct bubble (A or B)
            const targetId = (hasDetectedToolCall && toolBubbleId) ? toolBubbleId : streamingId;
            
            let extractedReasoning = null;
            let extractedContent = renderedResponse;
            const thinkMatch = renderedResponse.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
            if (thinkMatch) {
              extractedReasoning = thinkMatch[1].trim() || '...';
              extractedContent = renderedResponse.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
            }

            setMessages(prev => prev.map((m: any) =>
              m.id === targetId ? { 
                ...m, 
                content: extractedContent, 
                reasoning_content: extractedReasoning ?? (m.reasoning_content || '...') 
              } : m
            ));
          } else if (isSourceClosed) {
            clearTimeout(safetyTimeout);
            safeResolve();
          }
        }, 30);

        source.onmessage = (event) => {
          if (event.data === '[DONE]') {
            source.close();
            isSourceClosed = true;
            return;
          }
          try {
            const data = JSON.parse(event.data);
            if (data.chunk) {
              let cleanChunk = data.chunk;
              if (cleanChunk.includes('[CLEAR_STREAM]')) {
                fullResponse = '';
                renderedResponse = '';
                cleanChunk = cleanChunk.split('[CLEAR_STREAM]').pop() || '';
              }
              
              // Handle [TOOL_CALL_DETECTED] — freeze Bubble A, create Bubble B
              if (cleanChunk.includes('[TOOL_CALL_DETECTED]')) {
                if (!hasDetectedToolCall) {
                  hasDetectedToolCall = true;
                  const bubbleAContent = fullResponse;
                  if (bubbleAContent.trim()) {
                    // Freeze Bubble A with pre-tool text
                    setMessages(prev => prev.map((m: any) =>
                      m.id === streamingId ? { ...m, content: bubbleAContent, isStreaming: false } : m
                    ));
                  } else {
                    // Bubble A is empty (LLM went straight to tool) — remove it to avoid blank bubble
                    setMessages(prev => prev.filter((m: any) => m.id !== streamingId));
                  }
                  // Reset buffers for Bubble B
                  fullResponse = '';
                  renderedResponse = '';
                  // Create Bubble B for tool progress
                  toolBubbleId = `tool-${Date.now()}`;
                  setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: '', 
                    id: toolBubbleId, 
                    isStreaming: true,
                    progress: '⏳ Executing tools...'
                  } as any]);
                }
                cleanChunk = cleanChunk.replace(/\[TOOL_CALL_DETECTED\]/g, '');
              }
              
              if (cleanChunk.includes('[TOOL_CALL_FINISHED]')) {
                cleanChunk = cleanChunk.replace(/\[TOOL_CALL_FINISHED\]/g, '');
              }
              
              if (cleanChunk) {
                if (hasDetectedToolCall && toolBubbleId) {
                  // After tool call, new chunks go to Bubble B
                  fullResponse += cleanChunk;
                } else {
                  // Before tool call, chunks go to Bubble A
                  fullResponse += cleanChunk;
                }
              }
              // The intervalId loop will pick up fullResponse and smoothly render it.
            }
            if (data.progress) {
              // Progress updates go to Bubble B (or Bubble A if no tool call yet)
              const targetId = toolBubbleId || streamingId;
              setMessages(prev => prev.map((m: any) =>
                m.id === targetId ? { ...m, progress: data.progress } : m
              ));
            }
            if (data.error) {
              source.close();
              isSourceClosed = true;
              clearTimeout(safetyTimeout);
              if (intervalId) clearInterval(intervalId);
              reject(new Error(data.error));
            }
          } catch {}
        };

        // onerror: when SSE connection closes (normal after [DONE]), mark as closed and let interval resolve
        source.onerror = () => {
          source.close();
          isSourceClosed = true;
          // If there's nothing left to render, resolve immediately
          if (renderedResponse.length >= fullResponse.length) {
            clearTimeout(safetyTimeout);
            safeResolve();
          }
        };
      });

      // Sanitize final response to remove any LLM artifact tags that leaked through
      const sanitizeResponse = (text: string) => text
        .replace(/<tool_code>[\s\S]*?<\/tool_code>/gi, '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
        .replace(/<(?:execute_bash|execute)>[\s\S]*?<\/(?:execute_bash|execute)>/gi, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```(?:json)?\s*\[?\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]\s*```|```|$)/gi, '')
        .replace(/\[\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]|$)/gi, '')
        .trim();
      fullResponse = sanitizeResponse(fullResponse);
      renderedResponse = sanitizeResponse(renderedResponse);

      // Mark streaming as done and clean up placeholder field
      // Update both Bubble A and Bubble B (if exists)
      setMessages(prev => prev.map((m: any) => {
        if (m.id === streamingId) {
          // Bubble A: mark as done
          return { ...m, isStreaming: false };
        }
        if (toolBubbleId && m.id === toolBubbleId) {
          // Bubble B: final content, mark as done, clear progress
          return { ...m, content: fullResponse, isStreaming: false, progress: undefined };
        }
        return m;
      }));
      hasBubblesRef.current = false; // Allow usePolling to resume fetchHistory()


      // Auto-rename on first prompt
      if (messages.length === 0 && currentSessionId) {
        const autoTitle = userMsg.length > 25 ? userMsg.substring(0, 25) + '...' : userMsg;
        renameSession(currentSessionId, autoTitle);
      }

      // Skip fetchHistory() to avoid overwriting our carefully crafted bubble messages
      // The server will already have the clean state, and fetching it would lose our id tracking
      
      // Trigger TTS if in voice mode
      if (isVoiceModeRef.current && fullResponse) {
        speak(fullResponse);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove streaming placeholder on failure
      setMessages(prev => prev.filter((m: any) => m.id !== streamingId));
    } finally {
      setIsLoading(false);
      const textarea = document.querySelector('.chat-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        setTimeout(() => textarea.focus(), 150);
      }
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
    let cleanContent = content
      // Strip <think> blocks
      .replace(/(?:```(?:xml|html)?\s*)?<think>[\s\S]*?<\/think>(?:\s*```)?|```think[\s\S]*?```/gi, '')
      // Strip <tool_code> blocks (LLM pseudo-code leakage)
      .replace(/<tool_code>[\s\S]*?<\/tool_code>/gi, '')
      // Strip <tool_call> blocks
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      // Strip <execute_bash> / <execute> blocks
      .replace(/<(?:execute_bash|execute)>[\s\S]*?<\/(?:execute_bash|execute)>/gi, '')
      // Strip markdown tool calls
      .replace(/```(?:json)?\s*\[?\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]\s*```|```|$)/gi, '')
      // Strip raw JSON tool arrays
      .replace(/\[\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]|$)/gi, '')
      .trim();


    return (
      <div className="markdown-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowWrap: 'anywhere' }}>
        {cleanContent && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {cleanContent}
          </ReactMarkdown>
        )}
      </div>
    );
  };

  const greetings = [
    {
      title: "What's on your mind?",
      desc: "I am Nyxora, your autonomous Web3 assistant. Ask me to analyze tokens, manage your portfolio, or execute on-chain transactions."
    },
    {
      title: "Ready to explore Web3?",
      desc: "From swapping tokens to yield farming, just tell me what to do and I'll handle the complex smart contracts."
    },
    {
      title: "How can I assist your portfolio today?",
      desc: "I can read market sentiment, estimate gas fees, and protect your wallet from malicious allowances."
    },
    {
      title: "Navigate the crypto markets with ease.",
      desc: "Whether you need a bridge to Arbitrum, Optimism, Base, BSC, Polygon, or liquidity on Uniswap, I am ready to execute your commands."
    },
    {
      title: "Your autonomous DeFi command center.",
      desc: "I am Nyxora. I will securely route your trades and execute DeFi strategies without compromising your keys."
    },
    {
      title: "Your autonomous Local System Assistant.",
      desc: "I can read files on your computer, securely execute terminal commands, and manage your local directories natively."
    },
    {
      title: "Automate your daily OS workflows.",
      desc: "Whether you need to parse local PDFs, draft documents, or run background bash scripts, I am ready to execute your commands."
    },
    {
      title: "Beyond the Blockchain.",
      desc: "My capabilities extend to your local machine. Just ask me to analyze system logs, organize your workspace, or send an email."
    }
  ];

  // Pick a random greeting every time the component renders an empty chat state
  // We use the activeSessionId as a dependency so it changes when you switch/create chats
  const [greetingIndex, setGreetingIndex] = useState(0);

  useEffect(() => {
    // Rotate every 2 minutes (120,000 ms) for better UX
    const interval = setInterval(() => {
      setGreetingIndex(prev => (prev + 1) % greetings.length);
    }, 120000);
    return () => clearInterval(interval);
  }, [greetings.length]);

  useEffect(() => {
    // Reset to random on new session or empty chat
    setGreetingIndex(Math.floor(Math.random() * greetings.length));
  }, [activeSessionId, messages.length === 0, greetings.length]);

  const currentGreeting = greetings[greetingIndex];

  if (!isAuthenticated) {
    return <Login onLogin={() => {
      setIsAuthenticated(true);
      localStorage.setItem('nyxora_auth', 'true');
    }} />;
  }

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
        {!!(window as any).ipcRenderer && !navigator.userAgent.includes('Mac') && (
          <div style={{ display: 'flex', gap: '8px', padding: '16px 16px 0 20px', WebkitAppRegion: 'drag' } as any}>
            <button 
              onClick={() => (window as any).ipcRenderer.send('window-control', 'close')}
              style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56', border: '1px solid #e0443e', cursor: 'pointer', WebkitAppRegion: 'no-drag' } as any}
              title="Close"
            />
            <button 
              onClick={() => (window as any).ipcRenderer.send('window-control', 'minimize')}
              style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e', border: '1px solid #dea123', cursor: 'pointer', WebkitAppRegion: 'no-drag' } as any}
              title="Minimize"
            />
            <button 
              onClick={() => (window as any).ipcRenderer.send('window-control', 'maximize')}
              style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f', border: '1px solid #1aab29', cursor: 'pointer', WebkitAppRegion: 'no-drag' } as any}
              title="Maximize"
            />
          </div>
        )}
        <div className="agent-identity-card" style={{ paddingTop: !!(window as any).ipcRenderer && !navigator.userAgent.includes('Mac') ? '12px' : '24px', position: 'relative' }}>
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
              position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '8px'
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
              onClick={() => createNewSession()}
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
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentView('settings')}
              title={isSidebarCollapsed ? "Settings" : undefined}
            >
              <SettingsIcon size={15} className="nav-icon" /> <span className="nav-label">Settings</span>
            </div>
          </nav>

          <div className="sidebar-section" style={{ marginTop: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Workspaces</span>
            {!isSidebarCollapsed && (
              <button 
                onClick={importProject}
                title="Import Project"
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '4px', 
                  borderRadius: '4px' 
                }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            )}
          </div>
          
          <nav className="sidebar-nav sessions-list">
            {projects.map((project) => {
              const isExpanded = expandedProjects[project.id];
              const projectSessions = chatSessions.filter(s => s.project_id === project.id);
              
              return (
                <div key={project.id}>
                  <div 
                    className="nav-item project-item"
                    onClick={() => setExpandedProjects(prev => ({ ...prev, [project.id]: !isExpanded }))}
                    style={{ fontWeight: 600, color: 'var(--text-primary)', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Folder size={15} className="nav-icon" />
                      <span className="nav-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem' }}>{project.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          createNewSession(project.id);
                          setExpandedProjects(prev => ({ ...prev, [project.id]: true })); 
                        }} 
                        title="New Chat in Workspace"
                        style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Plus size={14} />
                      </button>
                      <button 
                        onClick={(e) => deleteProject(project.id, e)} 
                        title="Remove Workspace"
                        style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  
                  {isExpanded && projectSessions.map(session => (
                    <div 
                      key={session.id}
                      className={`nav-item session-item ${activeSessionId === session.id && currentView === 'chat' ? 'active' : ''}`}
                      onClick={() => { setActiveSessionId(session.id); setCurrentView('chat'); }}
                      style={{ paddingLeft: '32px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                        <span className="nav-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem', opacity: 0.8 }}>{session.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="delete-session-btn" onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditSessionTitle(session.title); }} title="Rename Session">
                          <Edit2 size={12} strokeWidth={1.5} />
                        </button>
                        <button className="delete-session-btn" onClick={(e) => deleteSession(session.id, e)} title="Delete Session">
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </nav>
          
          <div className="sidebar-section" style={{ marginTop: '0px' }}>
            <span>Recent</span>
          </div>
          <nav className="sidebar-nav sessions-list">
            {chatSessions.filter(s => !s.project_id).map((session) => (
              <div 
                key={session.id}
                className={`nav-item session-item ${activeSessionId === session.id && currentView === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setCurrentView('chat');
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                  <span className="nav-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{session.title}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="delete-session-btn" onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditSessionTitle(session.title); }} title="Rename Session">
                    <Edit2 size={12} strokeWidth={1.5} />
                  </button>
                  <button className="delete-session-btn" onClick={(e) => deleteSession(session.id, e)} title="Delete Session">
                    <Trash2 size={14} strokeWidth={1.5} />
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
              {currentView === 'search' ? 'Search Chat' : currentView}
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
          <Portfolio baseFiat={config?.agent?.base_fiat || 'usd'} />
        ) : currentView === 'settings' ? (
          <Settings 
            config={config} 
            onConfigChange={setConfig} 
            autoLockTime={autoLockTime} 
            setAutoLockTime={(val: number) => { setAutoLockTime(val); localStorage.setItem('nyxora_auto_lock', val.toString()); }}
            onLogout={() => {
              setIsAuthenticated(false);
              localStorage.removeItem('nyxora_auth');
              setCurrentView('chat');
            }} 
          />
        ) : (
            <div className="workspace-container">
              <div className={`chat-wrapper ${messages.length === 0 ? 'empty-state-wrapper' : ''}`} style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {messages.length === 0 && (
                  <div key={greetingIndex} className="empty-state-container" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    animation: 'fadeInUp 0.8s ease-out forwards',
                    textAlign: 'center',
                    marginBottom: '40px'
                  }}>
                    <div style={{
                      background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.15) 0%, transparent 70%)',
                      padding: '40px',
                      borderRadius: '50%',
                      marginBottom: '20px'
                    }}>
                      <NyxoraLogo size={80} color="var(--accent)" />
                    </div>
                    <h1 className="empty-state-title" style={{
                      fontSize: '3rem',
                      fontWeight: 700,
                      marginBottom: '16px',
                      letterSpacing: '-1px'
                    }}>
                      {currentGreeting.title}
                    </h1>
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '1.2rem',
                      maxWidth: '500px',
                      lineHeight: '1.6'
                    }}>
                      {currentGreeting.desc}
                    </p>
                  </div>
                )}

                <div className="chat-container" ref={chatContainerRef} style={{ flexGrow: messages.length === 0 ? 0 : 1, display: messages.length === 0 ? 'none' : 'flex', flexDirection: 'column' }}>
                  <div style={{ maxWidth: '760px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '0', paddingBottom: '160px' }}>

                {(() => {
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
                          if (m.tool_calls) {
                            currentAssistantMsg.tool_calls = [...(currentAssistantMsg.tool_calls || []), ...m.tool_calls];
                          }
                          if (m.content && m.content.trim() !== '') {
                            if (currentAssistantMsg.tool_calls && currentAssistantMsg.tool_calls.length > 0) {
                               currentAssistantMsg.content = m.content.trim();
                            } else {
                               currentAssistantMsg.content = (currentAssistantMsg.content && currentAssistantMsg.content.trim() !== '')
                                 ? currentAssistantMsg.content.trim() + '\n\n' + m.content.trim() 
                                 : m.content.trim();
                            }
                          }
                          if (m.reasoning_content) {
                            currentAssistantMsg.reasoning_content = (currentAssistantMsg.reasoning_content || '') + m.reasoning_content;
                          }
                          currentAssistantMsg.isStreaming = currentAssistantMsg.isStreaming || m.isStreaming;
                        } else {
                          currentAssistantMsg = { ...m };
                        }
                      }
                      // Ignored roles (e.g., 'tool') to maintain exact same array indices (keys) between streaming and history states.
                    }
                    if (currentAssistantMsg) {
                      merged.push(currentAssistantMsg);
                    }
                    return merged;
                  };
                  return getMergedMessages(messages).map((msg, idx) => {
                  const handleCopy = () => {
                  navigator.clipboard.writeText(msg.content);
                setCopiedIndex(idx);
                setTimeout(() => setCopiedIndex(null), 2000);
              };

              if (msg.role === 'user') {
                const isClamped = clampedMessages[idx] !== false; // default to true
                return (
                  <div key={idx} className="message-wrapper user">
                    <div 
                      className={`user-bubble ${isClamped ? 'clamped' : ''}`}
                      onClick={() => toggleClamp(idx)}
                    >
                      {msg.content}
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); handleCopy(); }} title="Copy" style={{ position: 'absolute', top: 6, right: 6, marginTop: 0 }}>
                        {copiedIndex === idx ? <Check size={12} color="#4caf50" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                );
              }
              if (msg.role === 'assistant' && (msg.content || msg.tool_calls || msg.progress || msg.reasoning_content)) {
                return (
                  <div key={idx} className="message-wrapper agent">

                    {/* Tool progress */}
                    {msg.progress && (
                      <div className="tool-call-text" style={{ marginBottom: msg.content ? '8px' : '0' }}>
                        <span dangerouslySetInnerHTML={{ __html: msg.progress.replace(/_([^_]+)_/g, '<i>$1</i>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                    )}

                    {/* Status Stack */}
                    {(msg.reasoning_content?.trim() || (msg.tool_calls && msg.tool_calls.length > 0)) && (
                      <details className="status-stack" open style={{ marginBottom: msg.content ? '16px' : '0' }}>
                        <summary>
                          Worked <ChevronDown size={14} />
                        </summary>
                        <div className="status-stack-items">
                          
                          {/* Thought Process */}
                          {msg.reasoning_content && msg.reasoning_content.trim() !== '' && (
                            <details className="status-item">
                              <summary>
                                <span>Thought Process</span>
                                <ChevronRight size={14} style={{ opacity: 0.5 }} />
                              </summary>
                              <div className="status-item-content">
                                {renderMessageContent(msg.reasoning_content)}
                              </div>
                            </details>
                          )}

                          {/* Tool Calls */}
                          {msg.tool_calls && msg.tool_calls.map((tool: any, tIdx: number) => {
                            let toolDesc = `Ran ${tool.function.name}`;
                            let argStr = '';
                            try {
                              const args = typeof tool.function.arguments === 'string' ? JSON.parse(tool.function.arguments) : tool.function.arguments;
                              if (args) {
                                argStr = typeof tool.function.arguments === 'string' ? tool.function.arguments : JSON.stringify(tool.function.arguments, null, 2);
                                const argValues = Object.values(args).map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(' ');
                                if (argValues) toolDesc += ` ${argValues}`;
                              }
                            } catch (e) {
                              argStr = String(tool.function.arguments);
                            }
                            
                            // Truncate if too long
                            if (toolDesc.length > 60) toolDesc = toolDesc.substring(0, 60) + '...';

                            return (
                              <details key={`t-${tIdx}`} className="status-item">
                                <summary>
                                  <span>{toolDesc}</span>
                                  <ChevronRight size={14} style={{ opacity: 0.5 }} />
                                </summary>
                                {argStr && (
                                  <div className="status-item-content">
                                    <pre style={{ margin: 0, fontSize: '0.75rem', background: 'transparent', padding: 0 }}>
                                      {argStr}
                                    </pre>
                                  </div>
                                )}
                              </details>
                            );
                          })}
                        </div>
                      </details>
                    )}

                    {/* Assistant content - flat, no bubble */}
                    {msg.content && msg.content.trim() !== '' && (
                      <div className="agent-body">
                        {renderMessageContent(msg.content)}
                      </div>
                    )}

                    <button className="copy-btn" onClick={handleCopy} title="Copy message">
                      {copiedIndex === idx ? <Check size={12} color="#4caf50" /> : <Copy size={12} />}
                    </button>
                  </div>
                );
              }
              return null;
            });
            })()}

            {isLoading && !messages.some(m => m.isStreaming && (m.content || m.progress || m.reasoning_content)) && (
              <div className="typing-indicator">Working</div>
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
              <form onSubmit={handleSend} className="input-form">
                <textarea
                  id="chat-input-textarea"
                  className="chat-input styled-scroll"
                  placeholder="Give Nyxora a task"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as unknown as React.FormEvent);
                    }
                  }}
                  disabled={isLoading}
                  rows={1}
                  style={{ resize: 'none', minHeight: '24px', paddingTop: '2px' }}
                />
                <button type="submit" className="send-button" disabled={isLoading || !input.trim()} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%' }}>
                  {isLoading ? (
                    <Loader2 size={16} className="spinner" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
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
              style={{ width: '100%', boxSizing: 'border-box', background: '#2d2d3b', border: '1px solid #4a4a5a', borderRadius: '12px', padding: '12px 16px', color: '#f8fafc', fontSize: '1rem', outline: 'none', marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setEditingSessionId(null)}
                style={{ background: 'transparent', border: '1px solid #4a4a5a', color: '#94a3b8', cursor: 'pointer', padding: '10px 20px', borderRadius: '24px', fontWeight: 500, fontSize: '0.9rem' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2d2d3b'}
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

      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '32px', width: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', border: '1px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Shield size={28} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 600 }}>Authentication Required</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
              Please enter your Nyxora Auth Token to connect to the backend server.
            </p>
            <input 
              type="password" 
              placeholder="x-nyxora-token"
              value={authModalInput}
              onChange={(e) => setAuthModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && authModalInput.trim()) {
                  localStorage.setItem('nyxora_token', authModalInput.trim());
                  window.location.reload();
                }
              }}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', marginBottom: '24px' }}
            />
            <button 
              onClick={() => {
                if (authModalInput.trim()) {
                  localStorage.setItem('nyxora_token', authModalInput.trim());
                  window.location.reload();
                }
              }}
              disabled={!authModalInput.trim()}
              style={{ width: '100%', background: 'var(--accent)', border: 'none', color: '#13131a', cursor: authModalInput.trim() ? 'pointer' : 'not-allowed', padding: '14px 20px', borderRadius: '12px', fontWeight: 600, fontSize: '1rem', opacity: authModalInput.trim() ? 1 : 0.5 }}
            >
              Connect to Server
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
