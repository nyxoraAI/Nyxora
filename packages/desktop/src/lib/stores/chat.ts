import { writable } from 'svelte/store';
import { apiFetch } from '$lib/utils/api';

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  reasoning_content?: string;
  tool_calls?: any[];
  progressLogs?: { text: string; time: number }[];
  isOptimistic?: boolean;
  isStreaming?: boolean;
  progress?: string;
  duration_ms?: number;
}

export interface ChatSession {
  id: string;
  title: string;
}

function createChatStore() {
  const { subscribe, set, update } = writable({
    messages: [] as Message[],
    sessions: [] as ChatSession[],
    isLoading: false,
  });

  return {
    subscribe,
    setMessages: (messages: Message[]) => update(s => ({ ...s, messages: Array.isArray(messages) ? messages : [] })),
    setSessions: (sessions: ChatSession[]) => update(s => ({ ...s, sessions: Array.isArray(sessions) ? sessions : [] })),
    setLoading: (isLoading: boolean) => update(s => ({ ...s, isLoading })),
    addMessage: (message: Message) => update(s => ({ ...s, messages: [...s.messages, message] })),
    updateMessage: (id: string, updates: Partial<Message>) => update(s => ({
      ...s,
      messages: s.messages.map(m => m.id === id ? { ...m, ...updates } : m)
    })),
    removeMessage: (id: string) => update(s => ({
      ...s,
      messages: s.messages.filter(m => m.id !== id)
    })),
  };
}

export const chatStore = createChatStore();
