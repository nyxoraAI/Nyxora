<script lang="ts">
  import { appState } from '$lib/stores/app';
  import { PanelLeftClose, Edit, Search, Wallet, TrendingUp, Settings } from 'lucide-svelte';
  import NyxoraLogo from './NyxoraLogo.svelte';
  import { chatStore } from '$lib/stores/chat';
  import { apiFetch } from '$lib/utils/api';
  import { onMount } from 'svelte';

  let currentView = $derived($appState.currentView);
  let isCollapsed = $derived($appState.isSidebarCollapsed);

  let localWorkspaces = $derived($appState.localWorkspaces);
  let activeWorkspace = $derived($appState.activeWorkspace);
  let expandedProjects = $state<Record<string, boolean>>({});

  // Fetch desktop sessions from API on mount
  onMount(async () => {
    try {
      const response = await apiFetch('/api/sessions?client=desktop');
      const sessions = await response.json();
      chatStore.setSessions(sessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  });

  async function openFolder() {
    try {
      const folderPath = await window.ipcRenderer?.invoke('open-directory');
      if (folderPath) {
        // Add workspace to backend (projects table) with client='desktop'
        const name = getFolderName(folderPath);
        await apiFetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, path: folderPath, client: 'desktop' })
        });
        appState.addWorkspace(folderPath);
        // Auto-expand the new project
        expandedProjects[folderPath] = true;
      }
    } catch (err) {
      console.error('Failed to open directory:', err);
    }
  }

  function getFolderName(path: string) {
    // Basic cross-platform folder name extraction
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  }

  function toggleProjectExpand(workspace: string) {
    expandedProjects[workspace] = !expandedProjects[workspace];
  }

  async function getProjectIdByPath(workspacePath: string): Promise<string | null> {
    try {
      const projectsRes = await apiFetch('/api/projects?client=desktop');
      const projects = await projectsRes.json();
      const project = projects.find((p: any) => p.path === workspacePath);
      return project?.id || null;
    } catch {
      return null;
    }
  }

  async function createProjectSession(workspace: string) {
    try {
      // Get project from backend by path (only desktop projects)
      const projectsRes = await apiFetch('/api/projects?client=desktop');
      const projects = await projectsRes.json();
      const project = projects.find((p: any) => p.path === workspace);
      
      if (project) {
        const title = 'New Chat';
        const response = await apiFetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, project_id: project.id, client: 'desktop' })
        });
        const data = await response.json();
        appState.setActiveSession(data.id);
        appState.setActiveWorkspace(workspace);
        appState.setView('chat');
        chatStore.setMessages([]);
        await fetchSessions();
      }
    } catch (err) {
      console.error('Failed to create project session:', err);
    }
  }

  async function fetchSessions() {
    try {
      const response = await apiFetch('/api/sessions?client=desktop');
      const sessions = await response.json();
      chatStore.setSessions(sessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }

  async function loadSessionMessages(sessionId: string) {
    try {
      const response = await apiFetch(`/api/history?session_id=${sessionId}`);
      const messages = await response.json();
      chatStore.setMessages(messages);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  }

  async function handleSessionClick(sessionId: string, workspace: string | null = null) {
    appState.setActiveSession(sessionId);
    appState.setActiveWorkspace(workspace);
    await loadSessionMessages(sessionId);
  }

  async function deleteSession(sessionId: string, e: MouseEvent) {
    e.stopPropagation();
    try {
      await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      await fetchSessions();
      // If deleting active session, clear it
      if ($appState.activeSessionId === sessionId) {
        appState.setActiveSession(null);
        chatStore.setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }

  function handleNewChat() {
    chatStore.setMessages([]);
    appState.setActiveSession(null);
    appState.setView('chat');
  }
</script>

{#if !isCollapsed}
<div class="flex-shrink-0 w-[240px] h-full bg-gray-50 dark:bg-[#242933] border-r border-gray-200 dark:border-[#434c5e] flex flex-col text-sm text-gray-700 dark:text-[#d8dee9] transition-all duration-300">
  <!-- Header -->
  <div class="p-3 pt-4 flex items-center justify-between drag-region mb-2">
    <div class="flex items-center gap-2 px-2 no-drag-region cursor-pointer text-blue-500 hover:text-blue-600 dark:text-[#88c0d0] dark:hover:text-blue-400 transition-colors">
      <NyxoraLogo size={24} color="currentColor" />
      <span class="font-medium text-[15px] text-blue-500 dark:text-[#88c0d0]">Nyxora AI</span>
    </div>
    <button onclick={() => appState.toggleSidebar()} class="p-1.5 hover:bg-gray-200 dark:hover:bg-[#434c5e] rounded-md text-gray-500 dark:text-[#d8dee9] hover:text-black dark:hover:text-[#eceff4] no-drag-region cursor-pointer" aria-label="Close sidebar">
      <PanelLeftClose size={18} />
    </button>
  </div>
  
  <div class="flex-1 overflow-y-auto px-3 space-y-0.5 scrollbar-none">
    <!-- Main Links -->
    <button onclick={handleNewChat} class="w-full flex items-center gap-3 px-3 py-1.5 rounded-full transition-colors {currentView === 'chat' && $chatStore.messages.length === 0 && !$appState.isSearchOpen ? 'bg-blue-500 dark:bg-[#88c0d0] text-white' : 'hover:bg-gray-200 dark:hover:bg-[#434c5e] hover:text-black dark:hover:text-[#eceff4]'}">
      <Edit size={16} />
      <span>New Chat</span>
    </button>
    <button onclick={() => appState.toggleSearch()} class="w-full flex items-center gap-3 px-3 py-1.5 rounded-full transition-colors {$appState.isSearchOpen ? 'bg-blue-500 dark:bg-[#88c0d0] text-white' : 'hover:bg-gray-200 dark:hover:bg-[#434c5e] hover:text-black dark:hover:text-[#eceff4]'}">
      <Search size={16} />
      <span>Search</span>
    </button>
    <button onclick={() => appState.setView('portfolio')} class="w-full flex items-center gap-3 px-3 py-1.5 rounded-full transition-colors {currentView === 'portfolio' ? 'bg-blue-500 dark:bg-[#88c0d0] text-white' : 'hover:bg-gray-200 dark:hover:bg-[#434c5e] hover:text-black dark:hover:text-[#eceff4]'}">
      <Wallet size={16} />
      <span>Wallet</span>
    </button>
    <button onclick={() => appState.setView('market')} class="w-full flex items-center gap-3 px-3 py-1.5 rounded-full transition-colors {currentView === 'market' ? 'bg-blue-500 dark:bg-[#88c0d0] text-white' : 'hover:bg-gray-200 dark:hover:bg-[#434c5e] hover:text-black dark:hover:text-[#eceff4]'}">
      <TrendingUp size={16} />
      <span>Market</span>
    </button>

    <!-- Local Workspaces / Folders -->
    <div class="pt-4 pb-2 px-3 text-xs font-semibold text-gray-500 flex justify-between items-center">
      <span>Projects</span>
      <button onclick={openFolder} class="hover:text-black dark:hover:text-[#eceff4] transition-colors" title="Open Folder">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      </button>
    </div>
    
    {#if localWorkspaces.length === 0}
      <div class="px-2 py-3 text-xs text-center text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-[#434c5e] rounded-lg mx-2 mt-1 mb-2">
        No projects opened.<br/>Click + to add a project.
      </div>
    {:else}
      <div class="px-2 space-y-3 mt-1 mb-2">
        {#each localWorkspaces as workspace}
          <div class="group relative">
            <div class="w-full flex items-center gap-2 text-gray-500 dark:text-[#d8dee9] text-[13px] font-medium mb-1.5 px-2">
              <button
                onclick={() => toggleProjectExpand(workspace)}
                class="flex items-center gap-2 flex-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-w-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                <span class="flex-1 text-left truncate">{getFolderName(workspace)}</span>
                <span class="text-[10px] transition-transform duration-200 {expandedProjects[workspace] ? 'rotate-180' : ''}">▼</span>
              </button>
              <!-- Actions -->
              <div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                <button onclick={(e) => { e.stopPropagation(); createProjectSession(workspace); }} class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" title="New Chat in Project">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <!-- Remove button -->
                <button
                  onclick={(e) => { e.stopPropagation(); appState.removeWorkspace(workspace); }}
                  class="text-gray-400 hover:text-red-500"
                  title="Remove Project"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            
            {#if expandedProjects[workspace]}
              {#await getProjectIdByPath(workspace) then projectId}
                {#if projectId}
                  <div class="space-y-0.5 ml-4 mt-1">
                    {#each $chatStore.sessions.filter(s => s.project_id === projectId) as session}
                      <div class="group/session relative w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-full text-[13px] transition-colors {$appState.activeSessionId === session.id ? 'bg-blue-500 dark:bg-[#88c0d0] text-white' : 'text-gray-600 dark:text-[#d8dee9] hover:bg-gray-200 dark:hover:bg-[#434c5e] hover:text-black dark:hover:text-gray-200'}">
                        <button 
                          onclick={() => handleSessionClick(session.id, workspace)}
                          class="flex items-center gap-2 min-w-0 flex-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          <span class="truncate">{session.title}</span>
                        </button>
                        <button 
                          onclick={(e) => deleteSession(session.id, e)}
                          class="opacity-0 group-hover/session:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded"
                          title="Delete Chat"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 hover:text-red-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    {/each}
                    {#if $chatStore.sessions.filter(s => s.project_id === projectId).length === 0}
                      <div class="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500 italic">
                        No chats yet
                      </div>
                    {/if}
                  </div>
                {/if}
              {/await}
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Recent Chats -->
    <div class="pt-4 pb-1 px-3 text-xs font-semibold text-gray-500">Recent</div>
    {#if $chatStore.sessions.filter(s => !s.project_id).length > 0}
      <div class="px-2 space-y-0.5">
        {#each $chatStore.sessions.filter(s => !s.project_id) as session}
          <div class="group relative w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-full text-[13px] transition-colors {$appState.activeSessionId === session.id && !$appState.activeWorkspace ? 'bg-blue-500 dark:bg-[#88c0d0] text-white' : 'text-gray-600 dark:text-[#d8dee9] hover:bg-gray-200 dark:hover:bg-[#434c5e] hover:text-black dark:hover:text-[#eceff4]'}">
            <button 
              onclick={() => handleSessionClick(session.id, null)}
              class="flex items-center gap-2 min-w-0 flex-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="truncate">{session.title}</span>
            </button>
            <button 
              onclick={(e) => deleteSession(session.id, e)}
              class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded"
              title="Delete Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 hover:text-red-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="px-4 py-2 text-[13px] text-gray-400 dark:text-gray-500">
        No recent chats.
      </div>
    {/if}
  </div>

  <!-- Footer Profile -->
  <div class="px-3 pb-3">
    <button onclick={() => appState.toggleSettings()} class="w-full flex items-center gap-3 px-3 py-1.5 rounded-full transition-colors hover:bg-gray-200 dark:hover:bg-[#434c5e] hover:text-black dark:hover:text-[#eceff4] text-gray-700 dark:text-[#d8dee9]">
      <Settings size={16} />
      <span>Settings</span>
    </button>
  </div>
</div>
{/if}
