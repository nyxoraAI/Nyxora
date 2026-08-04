<script lang="ts">
  import { fade } from 'svelte/transition';
  import { appState } from '$lib/stores/app';
  import { configStore } from '$lib/stores/config.svelte';
  
  import { 
    User, Cpu, Palette, ShieldCheck, 
    Globe, TerminalSquare, Plug, BookOpen, Workflow,
    AlertTriangle, Server, Landmark, LineChart, Link2, X, RefreshCw, Search
  } from '@lucide/svelte';
  
  import AgentProfile from './settings/AgentProfile.svelte';
  import LlmEngine from './settings/LlmEngine.svelte';
  import Appearance from './settings/Appearance.svelte';
  import SecurityPrivacy from './settings/SecurityPrivacy.svelte';
  import Web3Skills from './settings/Web3Skills.svelte';
  import OsSkills from './settings/OsSkills.svelte';
  import ExternalSkills from './settings/ExternalSkills.svelte';
  import Playbooks from './settings/Playbooks.svelte';
  import RiskPolicy from './settings/RiskPolicy.svelte';
  import Integrations from './settings/Integrations.svelte';
  import McpSettings from './settings/McpSettings.svelte';

  let isOpen = $derived($appState.isSettingsOpen);
  let activeTab = $state('agent');
  let searchQuery = $state('');

  import { untrack } from 'svelte';

  let wasOpen = $state(false);

  $effect(() => {
    if (isOpen && !untrack(() => wasOpen)) {
      activeTab = untrack(() => $appState.settingsTab) || 'agent';
    }
    wasOpen = isOpen;
  });

  function closeSettings() {
    appState.closeSettings();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeSettings();
  }

  const menuGroups = [
    {
      title: 'General',
      items: [
        { id: 'agent', label: 'Agent Profile', icon: User, badgeBg: 'from-blue-500 to-blue-600 shadow-blue-500/25' },
        { id: 'llm', label: 'LLM Engine', icon: Cpu, badgeBg: 'from-purple-500 to-indigo-600 shadow-purple-500/25' },
        { id: 'appearance', label: 'Appearance', icon: Palette, badgeBg: 'from-amber-500 to-orange-600 shadow-orange-500/25' },
        { id: 'security', label: 'Security & Privacy', icon: ShieldCheck, badgeBg: 'from-rose-500 to-red-600 shadow-red-500/25' }
      ]
    },
    {
      title: 'Agent Capabilities',
      items: [
        { id: 'web3skills', label: 'Web3 Skills', icon: Globe, badgeBg: 'from-emerald-500 to-teal-600 shadow-emerald-500/25' },
        { id: 'osskills', label: 'OS Skills', icon: TerminalSquare, badgeBg: 'from-cyan-500 to-blue-600 shadow-cyan-500/25' },
        { id: 'externalskills', label: 'External Skills', icon: Plug, badgeBg: 'from-violet-500 to-purple-600 shadow-violet-500/25' },
        { id: 'playbooks', label: 'Workflows', icon: Workflow, badgeBg: 'from-sky-500 to-blue-600 shadow-sky-500/25' }
      ]
    },
    {
      title: 'Advanced',
      items: [
        { id: 'risk', label: 'Risk & Policy', icon: AlertTriangle, badgeBg: 'from-yellow-500 to-amber-600 shadow-yellow-500/25' },
        { id: 'integrations', label: 'Integrations', icon: Link2, badgeBg: 'from-blue-600 to-indigo-700 shadow-blue-600/25' },
        { id: 'mcp', label: 'MCP Servers & Tools', icon: Server, badgeBg: 'from-purple-500 to-indigo-600 shadow-purple-500/25' }
      ]
    }
  ];

  let filteredGroups = $derived(
    menuGroups.map(g => ({
      ...g,
      items: g.items.filter(i => 
        i.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(g => g.items.length > 0)
  );
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 sm:p-8"
       role="dialog" aria-modal="true">
    
    <div class="bg-gray-50 dark:bg-[#18181b] w-[92vw] max-w-[1360px] h-[86vh] rounded-[22px] shadow-[0_25px_60px_rgba(0,0,0,0.55)] flex overflow-hidden border border-gray-200/80 dark:border-white/10 relative">
      
      <!-- Sleek macOS Style Sidebar (Solid for 60fps scroll performance) -->
      <div class="w-[260px] flex-shrink-0 border-r border-gray-200/60 dark:border-white/5 bg-gray-100 dark:bg-[#1d1d20] flex flex-col pt-6">
        <div class="px-6 pb-4">
          <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">Settings</h2>
          
          <!-- Search Bar -->
          <div class="relative">
            <input 
              type="text" 
              placeholder="Search settings..."
              bind:value={searchQuery}
              class="w-full bg-gray-200/70 dark:bg-black/40 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all border border-transparent dark:border-white/5"
            />
            <Search size={13} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            {#if searchQuery}
              <button 
                onclick={() => searchQuery = ''}
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={12} />
              </button>
            {/if}
          </div>
        </div>
        
        <!-- Navigation Groups -->
        <div class="flex-1 overflow-y-auto px-3 space-y-5 pb-6">
          {#if filteredGroups.length === 0}
            <div class="px-3 py-6 text-center text-gray-400 dark:text-gray-500 text-xs">
              No matching settings found.
            </div>
          {:else}
            {#each filteredGroups as group}
              <div>
                <div class="px-3 mb-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.title}
                </div>
                <div class="space-y-0.5">
                  {#each group.items as item}
                    {@const Icon = item.icon}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                      onclick={() => activeTab = item.id}
                      class="w-full flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all select-none {activeTab === item.id 
                        ? 'bg-gray-200/80 dark:bg-white/10 text-gray-900 dark:text-white font-semibold' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-white/5'}"
                    >
                      <div class="w-7 h-7 rounded-[8px] flex items-center justify-center transition-all {activeTab === item.id ? 'bg-[#0A84FF] text-white shadow-[0_4px_12px_rgba(10,132,255,0.25)]' : 'text-gray-500 dark:text-gray-400'}">
                        <Icon size={16} strokeWidth={activeTab === item.id ? 2.5 : 2.2} />
                      </div>
                      <span class="text-[13.5px] truncate flex-1">{item.label}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <div class="p-4 border-t border-gray-200/60 dark:border-white/5 text-[0.7rem] text-gray-400 dark:text-gray-500 flex items-center justify-between">
          <span>Nyxora OS v1.2</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0 bg-transparent">
        
        <!-- macOS Style Header Bar -->
        <div class="h-14 border-b border-gray-200/60 dark:border-white/5 flex items-center justify-between px-10 flex-shrink-0 bg-gray-100/50 dark:bg-[#18181b]">
          <div class="flex items-center gap-3">
            {#each menuGroups.flatMap(g => g.items) as item}
              {#if item.id === activeTab}
                {@const Icon = item.icon}
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br {item.badgeBg} flex items-center justify-center text-white shadow-sm">
                  <Icon size={16} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white leading-tight">{item.label}</h3>
                </div>
              {/if}
            {/each}
          </div>
          <button 
            onclick={() => appState.toggleSettings()} 
            class="p-2 bg-gray-200/60 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-full transition-all"
            aria-label="Close settings"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div class="px-10 pb-8 pt-8 overflow-y-auto flex-1 scrollbar-none relative z-10 transform-gpu" style="content-visibility: auto;">
          {#if configStore.isLoading && !configStore.config}
            <div class="flex items-center justify-center h-full">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          {:else if !configStore.config}
            <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div class="text-3xl mb-4 opacity-70">🔌</div>
              <h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Connection Failed</h3>
              <p class="text-[0.9rem] mb-6 max-w-md text-center">We couldn't load the settings from the backend. The server might be rate-limiting requests or temporarily unreachable.</p>
              <button 
                onclick={() => configStore.load()}
                class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </div>
          {:else}
            <div class="w-full max-w-4xl">
              {#if activeTab === 'agent'} <AgentProfile /> {/if}
              {#if activeTab === 'llm'} <LlmEngine /> {/if}
              {#if activeTab === 'appearance'} <Appearance /> {/if}
              {#if activeTab === 'security'} <SecurityPrivacy /> {/if}
              
              {#if activeTab === 'web3skills'} <Web3Skills /> {/if}
              {#if activeTab === 'osskills'} <OsSkills /> {/if}
              {#if activeTab === 'externalskills'} <ExternalSkills /> {/if}
              {#if activeTab === 'playbooks'} <Playbooks /> {/if}
              
              {#if activeTab === 'risk'} <RiskPolicy /> {/if}
              {#if activeTab === 'integrations'} <Integrations /> {/if}
              {#if activeTab === 'mcp'} <McpSettings /> {/if}
            </div>
          {/if}
        </div>

        <!-- Sticky Action Footer Bar -->
        {#if ['agent', 'llm', 'appearance', 'security', 'risk', 'integrations'].includes(activeTab)}
          <div class="px-8 py-3.5 border-t border-gray-200/60 dark:border-white/5 bg-gray-100 dark:bg-[#1c1d20] flex items-center justify-between flex-shrink-0 relative z-20">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {#if configStore.isSaving}
                <span class="text-blue-500 dark:text-blue-400 font-medium animate-pulse">Saving changes to system configuration...</span>
              {:else}
                Changes take effect across active agents immediately after saving.
              {/if}
            </div>
            <div class="flex items-center gap-2.5">
              <button 
                onclick={() => appState.toggleSettings()}
                class="px-4 py-1.5 bg-gray-200/60 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button 
                onclick={async () => {
                  await configStore.saveAll();
                  appState.toggleSettings();
                }}
                disabled={configStore.isSaving}
                class="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-medium transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {#if configStore.isSaving}
                  <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                {:else}
                  Save Configuration
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
