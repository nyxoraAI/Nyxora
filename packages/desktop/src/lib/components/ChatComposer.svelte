<script lang="ts">
  import { chatStore } from '$lib/stores/chat';
  import { appState } from '$lib/stores/app';

  let input = $state('');
  let isLoading = $derived($chatStore.isLoading);
  let activeWorkspace = $derived($appState.activeWorkspace);

  let isListening = $state(false);
  let isVoiceMode = $state(false);
  let isSpeaking = $state(false);
  let recognition: any = null;
  let fileInput: HTMLInputElement;

  import { onMount } from 'svelte';
  onMount(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        input = event.results[0][0].transcript;
        isListening = false;
        handleSubmit(); // Auto submit on voice input
      };
      recognition.onerror = () => isListening = false;
      recognition.onend = () => isListening = false;
    }
  });

  function startListening() {
    try {
      recognition?.start();
      isListening = true;
    } catch (e) {}
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.onstart = () => isSpeaking = true;
    utterance.onend = () => {
      isSpeaking = false;
      if (isVoiceMode) startListening();
    };
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoiceMode() {
    isVoiceMode = !isVoiceMode;
    if (isVoiceMode) {
      startListening();
    } else {
      recognition?.stop();
      isListening = false;
      window.speechSynthesis.cancel();
      isSpeaking = false;
    }
  }

  async function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    chatStore.setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        input = `Please analyze this document: ${data.filePath}`;
        handleSubmit();
      } else {
        chatStore.setLoading(false);
      }
    } catch (err) {
      chatStore.setLoading(false);
    }
    if (fileInput) fileInput.value = '';
  }

  function adjustHeight(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 256)}px`;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  import { API_BASE_URL, getToken, apiFetch } from '$lib/utils/api';

  async function handleSubmit() {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    input = '';
    
    // Reset height
    const textarea = document.querySelector('textarea');
    if (textarea) textarea.style.height = 'auto';

    chatStore.setLoading(true);
    
    const tempId = `temp-${Date.now()}`;
    chatStore.addMessage({ role: 'user', content: userMsg, isOptimistic: true });
    
    const streamingId = `streaming-${Date.now()}`;
    chatStore.addMessage({ role: 'assistant', content: '', id: streamingId, isStreaming: true });

    try {
      let currentSessionId = $appState.activeSessionId;
      
      if (!currentSessionId && !activeWorkspace) {
        // Create session via API (synced with dashboard)
        const title = userMsg.length > 30 ? userMsg.substring(0, 30) + '...' : userMsg;
        try {
          const response = await apiFetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, client: 'desktop' })
          });
          const data = await response.json();
          currentSessionId = data.id;
          appState.setActiveSession(currentSessionId);
          chatStore.setSessions([
            { id: currentSessionId, title },
            ...$chatStore.sessions
          ]);
        } catch (err) {
          console.error('Failed to create session:', err);
          // Fallback to local session if API fails
          currentSessionId = `desktop-${Date.now()}`;
          appState.setActiveSession(currentSessionId);
          chatStore.setSessions([
            { id: currentSessionId, title },
            ...$chatStore.sessions
          ]);
        }
      } else if (!currentSessionId && activeWorkspace) {
        // Create project-specific session
        try {
          const projectsRes = await apiFetch('/api/projects?client=desktop');
          const projects = await projectsRes.json();
          const project = projects.find((p: any) => p.path === activeWorkspace);
          
          if (project) {
            const title = userMsg.length > 30 ? userMsg.substring(0, 30) + '...' : userMsg;
            const response = await apiFetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, project_id: project.id, client: 'desktop' })
            });
            const data = await response.json();
            currentSessionId = data.id;
            appState.setActiveSession(currentSessionId);
          }
        } catch (err) {
          console.error('Failed to create project session:', err);
        }
      }

      const params = new URLSearchParams({
        message: userMsg,
        session_id: currentSessionId || '',
        token: getToken(),
      });
      if (activeWorkspace) {
        params.append('workspace', activeWorkspace);
      }

      const source = new EventSource(`${API_BASE_URL}/api/chat/stream?${params}`);
      
      let fullResponse = '';
      let renderedResponse = '';
      let currentProgressLogs: { text: string; time: number }[] = [];
      let currentReasoning = '';
      let isSourceClosed = false;

      const intervalId = setInterval(() => {
        if (renderedResponse.length < fullResponse.length) {
          const remaining = fullResponse.length - renderedResponse.length;
          const charsPerFrame = Math.max(2, Math.ceil(remaining / 4));
          const charsToAdd = fullResponse.slice(renderedResponse.length, renderedResponse.length + charsPerFrame);
          renderedResponse += charsToAdd;
          chatStore.updateMessage(streamingId, { content: renderedResponse });
        } else if (isSourceClosed) {
          clearInterval(intervalId);
          chatStore.updateMessage(streamingId, { isStreaming: false });
          chatStore.setLoading(false);
          if (isVoiceMode && fullResponse) speak(fullResponse);
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
          if (data.reasoning) {
            currentReasoning += data.reasoning;
            chatStore.updateMessage(streamingId, { reasoning_content: currentReasoning });
          }
          if (data.progress) {
            currentProgressLogs.push({ text: data.progress, time: Date.now() });
            chatStore.updateMessage(streamingId, { progress: data.progress, progressLogs: currentProgressLogs });
          }
          if (data.error) {
            source.close();
            isSourceClosed = true;
            chatStore.updateMessage(streamingId, { 
              content: fullResponse + `\n\n**Error:** ${data.error}`
            });
          }
        } catch (e) {
          console.error('Error parsing stream chunk', e);
        }
      };

      source.onerror = (error) => {
        source.close();
        isSourceClosed = true;
      };
    } catch (error) {
      chatStore.updateMessage(streamingId, { content: "Error connecting to backend.", isStreaming: false });
      chatStore.setLoading(false);
    }
  }
  import { Plus, LayoutGrid, Mic, Headphones } from 'lucide-svelte';
  import NyxoraLogo from './NyxoraLogo.svelte';
</script>

<div class="w-full flex-col flex { $chatStore.messages.length === 0 ? 'flex-1 items-center justify-center px-4' : 'px-4 md:px-8 max-w-4xl mx-auto mb-2 shrink-0' }">
  
  {#if $chatStore.messages.length === 0}
      <!-- Empty State Header -->
      <div class="flex items-center justify-center gap-4 mb-10 text-blue-500 dark:text-[#88c0d0]">
        <NyxoraLogo size={36} color="currentColor" />
        <div class="text-2xl font-medium">Nyxora AI</div>
      </div>
  {/if}

  <div class="w-full max-w-3xl transition-all duration-500">
    {#if activeWorkspace}
      <div class="mb-2 px-2 flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-[#81a1c1]">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
        Chatting in {activeWorkspace.split(/[/\\]/).pop()}
      </div>
    {/if}
    <div class="relative bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-3xl shadow-sm focus-within:border-blue-500 focus-within:ring-1 ring-blue-500 transition-all">
      <textarea 
        bind:value={input}
        oninput={adjustHeight}
        onkeydown={handleKeydown}
        disabled={isLoading}
        class="w-full bg-transparent resize-none outline-none pt-4 pb-14 px-5 min-h-[60px] max-h-64 text-base text-gray-900 dark:text-[#eceff4] placeholder-gray-400 scrollbar-none disabled:opacity-50" 
        placeholder="How can I help you today?" 
        rows="1"
      ></textarea>
      
      <input type="file" bind:this={fileInput} onchange={handleFileUpload} hidden />
      <div class="absolute bottom-2 left-3 right-3 flex items-center justify-between">
        <div class="flex items-center gap-1">
          <button onclick={() => fileInput.click()} class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-[#d8dee9] transition-colors"><Plus size={18}/></button>
          <button class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-[#d8dee9] transition-colors"><LayoutGrid size={18}/></button>
        </div>
        
        <div class="flex items-center gap-1">
          {#if input.trim()}
              <button 
                onclick={handleSubmit}
                disabled={isLoading}
                class="p-2 bg-blue-500 dark:bg-[#88c0d0] text-white rounded-full hover:opacity-80 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
          {:else}
            <button onclick={startListening} class="p-2 {isListening ? 'bg-red-500/20 text-red-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-[#d8dee9]'} rounded-full transition-colors"><Mic size={18}/></button>
            <button onclick={toggleVoiceMode} class="p-2 {isVoiceMode ? 'bg-blue-500/20 text-blue-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-[#d8dee9]'} rounded-full transition-colors"><Headphones size={18}/></button>
          {/if}
        </div>
      </div>
    </div>

    {#if $chatStore.messages.length === 0}
      <!-- Suggested Prompts -->
      <div class="mt-6 flex justify-center w-full px-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-3xl">
          <button onclick={() => input = "Show me a code snippet "} class="text-left flex flex-col items-start gap-0.5 p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-[#434c5e] transition-colors opacity-80 hover:opacity-100 group">
             <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-[#d8dee9] mb-1"><span class="rotate-45 font-serif text-sm">✦</span> Suggested</div>
             <div class="font-medium text-sm text-gray-800 dark:text-[#e5e9f0]">Show me a code snippet</div>
             <div class="text-xs text-gray-500">of a website's sticky header</div>
          </button>
          <button onclick={() => input = "Help me study "} class="text-left flex flex-col items-start gap-0.5 p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-[#434c5e] transition-colors opacity-80 hover:opacity-100 hidden md:flex">
             <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-[#d8dee9] mb-1 opacity-0"><span class="rotate-45 font-serif text-sm">✦</span></div>
             <div class="font-medium text-sm text-gray-800 dark:text-[#e5e9f0]">Help me study</div>
             <div class="text-xs text-gray-500">vocabulary for a college entrance exam</div>
          </button>
          <button onclick={() => input = "Overcome procrastination "} class="text-left flex flex-col items-start gap-0.5 p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-[#434c5e] transition-colors opacity-80 hover:opacity-100 hidden lg:flex">
             <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-[#d8dee9] mb-1 opacity-0"><span class="rotate-45 font-serif text-sm">✦</span></div>
             <div class="font-medium text-sm text-gray-800 dark:text-[#e5e9f0]">Overcome procrastination</div>
             <div class="text-xs text-gray-500">give me tips</div>
          </button>
        </div>
      </div>
    {/if}
  </div>
  
  {#if $chatStore.messages.length > 0}
    <div class="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-2">
      Nyxora can make mistakes. Consider verifying important information.
    </div>
  {/if}
</div>
