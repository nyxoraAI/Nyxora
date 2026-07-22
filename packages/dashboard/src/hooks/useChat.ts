import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  reasoning_content?: string;
  tool_calls?: any[];
  progressLogs?: any[];
  isOptimistic?: boolean;
  isStreaming?: boolean;
  progress?: string;
}

export const useChat = (isVoiceMode: boolean, speak: (text: string) => void) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('nyxora_active_session_id') || null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionTitle, setEditSessionTitle] = useState<string>('');
  
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('nyxora_active_session_id', activeSessionId);
    } else {
      localStorage.removeItem('nyxora_active_session_id');
    }
  }, [activeSessionId]);

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

          if (optimisticMsgs.length > 0) {
            const missingOptimistic = optimisticMsgs.filter(opt => !data.some((d: any) => d.role === 'user' && d.content === opt.content));
            if (missingOptimistic.length > 0) {
              return [...data, ...missingOptimistic];
            }
          }
          return data;
        });
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
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id);
        }
      }
    } catch {}
  };

  const createNewSession = async (projectId?: string) => {
    try {
      const body: any = { title: 'New Chat' };
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

  const deleteSession = async (id: string) => {
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
      await fetchSessions();
    } catch {}
  };

  const handleSend = async (e: React.FormEvent | null, customMsg?: string) => {
    e?.preventDefault();
    const userMsg = customMsg || input;
    if (!userMsg.trim() || isLoading) return;

    setInput('');
    setIsLoading(true);

    if (userMsg.trim() === '/clear') {
      if (activeSessionId) {
        try {
          await apiFetch(`/api/sessions/${activeSessionId}`, { method: 'DELETE' });
        } catch (err) {
          console.error('Failed to clear session', err);
        }
      }
      setActiveSessionId(null);
      setMessages([]);
      await fetchSessions();
      setIsLoading(false);
      return;
    }

    let currentSessionId = activeSessionId;

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
        console.error('Failed to auto-create session', err);
      }
    }

    setMessages(prev => [...prev, { role: 'user', content: userMsg, isOptimistic: true }]);

    const streamingId = `streaming-${Date.now()}`;
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: streamingId, isStreaming: true }]);

    let fullResponse = '';
    let renderedResponse = '';
    let intervalId: NodeJS.Timeout | null = null;

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

        intervalId = setInterval(() => {
          if (renderedResponse.length < fullResponse.length) {
            const remaining = fullResponse.length - renderedResponse.length;
            const charsPerFrame = Math.max(2, Math.ceil(remaining / 4)); 
            
            const charsToAdd = fullResponse.slice(renderedResponse.length, renderedResponse.length + charsPerFrame);
            renderedResponse += charsToAdd;
            setMessages(prev => prev.map(m =>
              m.id === streamingId ? { ...m, content: renderedResponse } : m
            ));
          } else if (isSourceClosed) {
            if (intervalId) clearInterval(intervalId);
            resolve();
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
              cleanChunk = cleanChunk.replace(/\[TOOL_CALL_DETECTED\]|\[TOOL_CALL_FINISHED\]/g, '');
              if (cleanChunk) {
                fullResponse += cleanChunk;
              }
            }
            if (data.progress) {
              setMessages(prev => prev.map(m =>
                m.id === streamingId ? { 
                  ...m, 
                  progress: data.progress,
                  progressLogs: [...(m.progressLogs || []), { text: data.progress, time: Date.now() }]
                } : m
              ));
            }
            if (data.error) {
              source.close();
              isSourceClosed = true;
              if (intervalId) clearInterval(intervalId);
              reject(new Error(data.error));
            }
          } catch {}
        };

        source.onerror = () => {
          source.close();
          isSourceClosed = true;
        };
      });

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

      setMessages(prev => prev.map(m =>
        m.id === streamingId ? { ...m, content: fullResponse, isStreaming: false } : m
      ));

      if (messages.length === 0 && currentSessionId) {
        const autoTitle = userMsg.length > 25 ? userMsg.substring(0, 25) + '...' : userMsg;
        renameSession(currentSessionId, autoTitle);
      }

      await fetchHistory();

      if (isVoiceMode && fullResponse) {
        speak(fullResponse);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== streamingId));
    } finally {
      setIsLoading(false);
      const textarea = document.querySelector('.chat-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        setTimeout(() => textarea.focus(), 150);
      }
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchSessions();
  }, [activeSessionId]);

  return {
    messages,
    setMessages,
    chatSessions,
    activeSessionId,
    setActiveSessionId,
    input,
    setInput,
    isLoading,
    setIsLoading,
    editingSessionId,
    setEditingSessionId,
    editSessionTitle,
    setEditSessionTitle,
    handleSend,
    fetchHistory,
    fetchSessions,
    createNewSession,
    renameSession,
    deleteSession
  };
};
