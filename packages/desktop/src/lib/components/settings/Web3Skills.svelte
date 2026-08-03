<script lang="ts">
  import { onMount } from 'svelte';
  import { Compass, Search, Wallet, Send, Zap, ArrowRightLeft, RefreshCw, Image, Terminal, MapPin, User, Shield, PieChart, LineChart, WalletCards, Target, ListOrdered, XCircle, Droplet, Lock, Vault, Landmark, Flame } from '@lucide/svelte';
  import { apiFetch } from '$lib/utils/api';

  interface SkillParam {
    type: string;
    description?: string;
    enum?: string[];
  }

  interface SkillDefinition {
    type: string;
    isActive?: boolean;
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, SkillParam>;
        required: string[];
      };
    };
  }

  let skills = $state<SkillDefinition[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const res = await apiFetch('/api/skills');
      if (res.ok) {
        skills = await res.json();
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  });

  function formatSkillName(name: string) {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Define dynamic component lookup for icons
  const iconMap: Record<string, any> = {
    'get balance': Wallet,
    'transfer token': Send,
    'get price': Zap,
    'swap token': ArrowRightLeft,
    'bridge token': RefreshCw,
    'mint nft': Image,
    'custom tx': Terminal,
    'check address': Search,
    'get my address': User,
    'check token security': Shield,
    'check portfolio': PieChart,
    'analyze market': LineChart,
    'get trending tokens': Flame,
    'create wallet': WalletCards,
    'supply aave': Landmark,
    'revoke approval': Lock,
    'deposit yield vault': Vault,
    'provide liquidity v3': Droplet,
    'create limit order': Target
  };

  async function handleToggle(skillName: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    
    // Optimistic update
    skills = skills.map(s => 
      s.function.name === skillName ? { ...s, isActive: newStatus } : s
    );

    try {
      await apiFetch('/api/skills/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName, active: newStatus })
      });
    } catch (e) {
      // Revert on error
      skills = skills.map(s => 
        s.function.name === skillName ? { ...s, isActive: currentStatus } : s
      );
      console.error('Failed to toggle skill', e);
    }
  }

  let filteredSkills = $derived(
    skills.filter(skill => 
      skill.function.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.function.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
</script>

{#if isLoading}
  <div class="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400 text-xs">
    <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
    Loading installed Web3 skills...
  </div>
{:else}
  <div class="space-y-7 w-full">
    <div>
      <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Web3 Skills</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Installed on-chain capabilities and their activation status.</p>

      <div class="flex items-center bg-gray-200/60 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl px-3.5 mb-6 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
        <Search size={15} class="text-gray-400 mr-2.5" />
        <input 
          type="text" 
          placeholder="Filter installed skills..." 
          bind:value={searchQuery}
          class="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 py-2 text-xs placeholder-gray-400"
        />
        <span class="text-gray-400 dark:text-gray-500 text-[0.75rem] font-medium">{filteredSkills.length} available</span>
      </div>

      <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Installed Capabilities</div>
      <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-200/60 dark:divide-white/10">
        {#each filteredSkills as skill (skill.function.name)}
          {@const isActive = skill.isActive !== false}
          {@const formattedName = formatSkillName(skill.function.name)}
          {@const IconComponent = iconMap[formattedName.toLowerCase()] || Compass}
          
          <div class="flex items-center justify-between p-4 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
            <div class="flex items-center gap-3.5 flex-1 pr-4">
              <div class="w-8 h-8 rounded-xl {isActive ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-gray-200/60 text-gray-400 dark:bg-white/5 dark:text-gray-500'} flex items-center justify-center flex-shrink-0 transition-colors">
                <IconComponent size={16} strokeWidth={2.2} />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="m-0 text-xs font-semibold {isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'} truncate">
                  {formattedName}
                </h3>
                <p class="m-0 mt-0.5 text-gray-500 dark:text-gray-400 text-[0.75rem] leading-normal line-clamp-1">
                  {skill.function.description}
                </p>
              </div>
            </div>
            
            <div class="flex-shrink-0">
              <button 
                onclick={() => handleToggle(skill.function.name, isActive)}
                class="relative w-9 h-5 rounded-full border-none cursor-pointer transition-colors duration-200 p-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#18181b] {isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}"
                aria-label="Toggle {formattedName}"
              >
                <div class="absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ease-out {isActive ? 'left-[18px]' : 'left-[2px]'}"></div>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
