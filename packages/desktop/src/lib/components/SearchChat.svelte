<script lang="ts">
  import { Search, MessageSquare } from 'lucide-svelte';
  import { apiFetch } from '$lib/utils/api';
  import { chatStore } from '$lib/stores/chat';
  import { appState } from '$lib/stores/app';
  import { onMount } from 'svelte';

  let query = $state('');
  let searchResults = $state<any[]>([]);
  let isSearching = $state(false);

  let timeoutId: number | null = null;
  
  async function handleSearch() {
    if (timeoutId) clearTimeout(timeoutId);
    
    if (!query.trim()) {
      searchResults = $chatStore.sessions.filter(s => !s.project_id);
      return;
    }

    isSearching = true;
    
    timeoutId = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/sessions/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const results = await res.json();
          // Filter only desktop sessions
          searchResults = results.filter((s: any) => !s.id.startsWith('telegram_') && !s.id.startsWith('discord_'));
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        isSearching = false;
      }
    }, 300);
  }

  function handleSelectSession(id: string) {
    const session = searchResults.find(s => s.id === id);
    appState.setActiveSession(id);
    if (session && session.project_id) {
      // Find workspace path from projects API... wait, this is synchronous.
      // We can just rely on the active session taking over.
      // Or we can find the project path if it exists in localWorkspaces.
    } else {
      appState.setActiveWorkspace(null);
    }
    appState.setView('chat');
    appState.toggleSearch(); // Close search
  }

  // Use $effect instead of $: for reactive statement
  $effect(() => {
    handleSearch();
  });
</script>

<div class="flex flex-col h-full bg-white dark:bg-[#1c1c1e] overflow-hidden">
  <!-- Search Header -->
  <div class="p-6 pb-4">
    <div class="relative">
      <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <Search size={18} />
      </div>
      <input
        type="text"
        bind:value={query}
        placeholder="Search conversations..."
        class="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-[#1d1d1f] rounded-full outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-[#ffffff] placeholder-gray-500"
        autofocus
      />
    </div>
  </div>

  <!-- Search Results -->
  <div class="flex-1 overflow-y-auto px-6 pb-6">
    {#if isSearching}
      <div class="text-center py-8 text-gray-500">
        Searching...
      </div>
    {:else if searchResults.length > 0}
      <div>
        <h3 class="text-xs font-semibold text-gray-500 dark:text-[#e5e5ea] mb-3 uppercase tracking-wider">
          {query.trim() ? 'Search Results' : 'Recent Chats'}
        </h3>
        <div class="space-y-2">
          {#each searchResults as session}
            <button
              onclick={() => handleSelectSession(session.id)}
              class="w-full flex items-center gap-4 px-5 py-3 rounded-full hover:bg-gray-100 dark:hover:bg-[#2f2f2f] transition-colors text-left"
            >
              <div class="text-gray-500 dark:text-[#e5e5ea]">
                <MessageSquare size={16} />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 dark:text-[#ffffff] truncate">
                  {session.title}
                </div>
                {#if session.timestamp}
                  <div class="text-xs text-gray-500 dark:text-[#e5e5ea] mt-0.5">
                    {new Date(session.timestamp).toLocaleDateString()}
                  </div>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {:else if query.trim()}
      <div class="text-center py-8 text-gray-500 dark:text-[#e5e5ea]">
        No conversations found for "{query}"
      </div>
    {:else}
      <div class="text-center py-8 text-gray-500 dark:text-[#e5e5ea]">
        No recent chats
      </div>
    {/if}
  </div>
</div>
