<script lang="ts">
  import { Network, ChevronDown } from 'lucide-svelte';
  import { getChainLogoUrl } from '$lib/utils/logos';

  let { value = $bindable(), showAllOption = false, onChange = undefined } = $props<{
    value: string;
    showAllOption?: boolean;
    onChange?: (network: string) => void;
  }>();

  let isOpen = $state(false);
  let dropdownRef: HTMLDivElement;

  const NETWORKS = [
    { id: 'ethereum', label: 'Ethereum' },
    { id: 'bsc', label: 'BNB Smart Chain' },
    { id: 'base', label: 'Base' },
    { id: 'arbitrum', label: 'Arbitrum One' },
    { id: 'robinhood', label: 'Robinhood Chain' },
    { id: 'optimism', label: 'OP Mainnet' },
    { id: 'polygon', label: 'Polygon (Matic)' },
    { id: 'sepolia', label: 'Sepolia (Testnet)' },
    { id: 'base_sepolia', label: 'Base Sepolia (Testnet)' },
    { id: 'arbitrum_sepolia', label: 'Arbitrum Sepolia' },
    { id: 'robinhood_testnet', label: 'Robinhood Testnet' },
    { id: 'optimism_sepolia', label: 'OP Sepolia' }
  ];

  let options = $derived(showAllOption 
    ? [{ id: 'all', label: 'All Chains' }, ...NETWORKS] 
    : NETWORKS
  );
  
  let currentNetwork = $derived(options.find(n => n.id === value) || options[0]);

  function handleSelect(id: string) {
    value = id;
    if (onChange) onChange(id);
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownRef}>
  <button 
    class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-[#1d1d1f] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-[#48484a] font-semibold text-sm" 
    onclick={() => isOpen = !isOpen}
    aria-expanded={isOpen}
  >
    <div class="w-4 h-4 relative flex items-center justify-center shrink-0">
      {#if currentNetwork.id === 'all'}
        <Network size={16} />
      {:else}
        <img 
          src={getChainLogoUrl(currentNetwork.id)} 
          alt={currentNetwork.id} 
          class="w-4 h-4 object-cover rounded-full" 
          onerror={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      {/if}
    </div>
    <span>{currentNetwork.label}</span>
    <ChevronDown size={14} />
  </button>

  {#if isOpen}
    <ul class="absolute top-full mt-1 right-0 w-48 max-h-60 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-[#3a3a3c] rounded-lg shadow-xl z-50 py-1 scrollbar-hidden">
      {#each options as net}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li 
          class="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-gray-100 dark:hover:bg-[#3a3a3c] {net.id === value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-[#0a84ff] font-semibold' : ''}"
          onclick={() => handleSelect(net.id)}
        >
          <div class="w-4 h-4 relative flex items-center justify-center shrink-0">
            {#if net.id === 'all'}
              <Network size={14} />
            {:else}
              <img 
                src={getChainLogoUrl(net.id)} 
                alt={net.id} 
                class="w-3.5 h-3.5 object-cover rounded-full" 
                onerror={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            {/if}
          </div>
          {net.label}
        </li>
      {/each}
    </ul>
  {/if}
</div>
