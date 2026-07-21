<script lang="ts">
  import { fade } from 'svelte/transition';
  import { appState } from '$lib/stores/app';
  import { configStore } from '$lib/stores/config.svelte';
  
  import { 
    User, Cpu, Palette, ShieldCheck, 
    Globe, TerminalSquare, Plug, BookOpen, 
    AlertTriangle, Server, Landmark, LineChart, Link2, X, RefreshCw
  } from 'lucide-svelte';
  
  import AgentProfile from './settings/AgentProfile.svelte';
  import LlmEngine from './settings/LlmEngine.svelte';
  import Appearance from './settings/Appearance.svelte';
  import SecurityPrivacy from './settings/SecurityPrivacy.svelte';
  import Web3Skills from './settings/Web3Skills.svelte';
  import OsSkills from './settings/OsSkills.svelte';
  import ExternalSkills from './settings/ExternalSkills.svelte';
  import Playbooks from './settings/Playbooks.svelte';
  import RiskPolicy from './settings/RiskPolicy.svelte';
  import RpcConfig from './settings/RpcConfig.svelte';
  import DefiConfig from './settings/DefiConfig.svelte';
  import MarketOracles from './settings/MarketOracles.svelte';
  import Integrations from './settings/Integrations.svelte';

  let isOpen = $derived($appState.isSettingsOpen);
  let activeTab = $state('agent');

  import { untrack } from 'svelte';

  let wasOpen = $state(false);

  $effect(() => {
    if (isOpen && !wasOpen) {
      untrack(() => {
        if (!configStore.isLoading) {
          configStore.load();
        }
      });
    } else if (!isOpen && wasOpen) {
      untrack(() => {
        if (!configStore.isLoading) {
          configStore.load();
        }
      });
    }
    wasOpen = isOpen;
  });

  const menuGroups = [
    {
      title: 'General',
      items: [
        { id: 'agent', label: 'Agent Profile', icon: User },
        { id: 'llm', label: 'LLM Engine', icon: Cpu },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'security', label: 'Security & Privacy', icon: ShieldCheck }
      ]
    },
    {
      title: 'Agent Capabilities',
      items: [
        { id: 'web3skills', label: 'Web3 Skills', icon: Globe },
        { id: 'osskills', label: 'OS Skills', icon: TerminalSquare },
        { id: 'externalskills', label: 'External Skills', icon: Plug },
        { id: 'playbooks', label: 'Playbooks', icon: BookOpen }
      ]
    },
    {
      title: 'Advanced',
      items: [
        { id: 'risk', label: 'Risk & Policy', icon: AlertTriangle },
        { id: 'rpc', label: 'RPC Config', icon: Server },
        { id: 'defi', label: 'DeFi Config', icon: Landmark },
        { id: 'oracles', label: 'Market Oracles', icon: LineChart },
        { id: 'integrations', label: 'Integrations', icon: Link2 }
      ]
    }
  ];
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 sm:p-8"
       role="dialog" aria-modal="true">
    
    <div class="bg-gray-50 dark:bg-[#1a1b1e] w-[92vw] max-w-[1400px] h-[88vh] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex overflow-hidden border border-gray-200 dark:border-white/10 relative">
      
      <!-- Close Button Floating -->
      <button 
        onclick={() => appState.toggleSettings()} 
        class="absolute top-6 right-6 p-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-full transition-colors z-50"
        aria-label="Close settings"
      >
        <X size={20} strokeWidth={2.5} />
      </button>

      <!-- Sleek Glass Sidebar -->
      <div class="w-[280px] flex-shrink-0 border-r border-gray-200/50 dark:border-white/5 bg-gray-50/80 dark:bg-black/20 flex flex-col pt-8">
        <div class="px-8 pb-6">
          <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400">Settings</h2>
        </div>
        
        <div class="flex-1 overflow-y-auto px-4 pb-8 space-y-8 scrollbar-none">
          {#each menuGroups as group}
            <div>
              <div class="text-[0.65rem] font-bold text-gray-400/90 dark:text-gray-500 mb-3 px-4 tracking-[0.2em] uppercase">{group.title}</div>
              <div class="space-y-1">
                {#each group.items as item}
                  {@const Icon = item.icon}
                  <button 
                    onclick={() => activeTab = item.id} 
                    class="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[0.9rem] font-medium transition-colors duration-100 {activeTab === item.id ? 'bg-blue-600 shadow-md shadow-blue-500/20 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/5'}"
                  >
                    <Icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} class={activeTab === item.id ? 'opacity-100' : 'opacity-70'} />
                    {item.label}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Content Area with Smooth Layout -->
      <div class="flex-1 flex flex-col bg-transparent relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50/30 dark:to-white/[0.02] pointer-events-none"></div>
        
        <div class="px-10 pb-10 pt-10 overflow-y-auto flex-1 scrollbar-none relative z-10">
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
            <!-- Removed transition:fade to ensure instant snappy switching -->
            <div class="pt-2 w-full pr-8">
              {#if activeTab === 'agent'} <AgentProfile /> {/if}
              {#if activeTab === 'llm'} <LlmEngine /> {/if}
              {#if activeTab === 'appearance'} <Appearance /> {/if}
              {#if activeTab === 'security'} <SecurityPrivacy /> {/if}
              
              {#if activeTab === 'web3skills'} <Web3Skills /> {/if}
              {#if activeTab === 'osskills'} <OsSkills /> {/if}
              {#if activeTab === 'externalskills'} <ExternalSkills /> {/if}
              {#if activeTab === 'playbooks'} <Playbooks /> {/if}
              
              {#if activeTab === 'risk'} <RiskPolicy /> {/if}
              {#if activeTab === 'rpc'} <RpcConfig /> {/if}
              {#if activeTab === 'defi'} <DefiConfig /> {/if}
              {#if activeTab === 'oracles'} <MarketOracles /> {/if}
              {#if activeTab === 'integrations'} <Integrations /> {/if}
              
              {#if ['agent', 'llm', 'appearance', 'security', 'risk', 'integrations'].includes(activeTab)}
                <div class="flex justify-end gap-3 mt-12 pt-6 border-t border-gray-200 dark:border-white/5">
                  <button 
                    onclick={() => appState.toggleSettings()}
                    class="px-6 py-2 bg-transparent hover:bg-gray-200 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onclick={async () => {
                      await configStore.saveAll();
                      appState.toggleSettings();
                    }}
                    disabled={configStore.isSaving}
                    class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {#if configStore.isSaving}
                      <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    {:else}
                      Save Configuration
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
