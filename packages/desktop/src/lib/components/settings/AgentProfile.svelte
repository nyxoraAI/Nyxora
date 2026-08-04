<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import Dropdown from '../Dropdown.svelte';
  import { getChainLogoUrl } from '$lib/utils/logos';
</script>

{#if configStore.config}
<div class="space-y-7 w-full">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Agent Profile</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Configure the core identity and behavior parameters of your agent.</p>
    
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Identity</div>
    <div class="flex flex-col bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-3.5 px-5">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Agent Name</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">The displayed name of your agent.</div>
        </div>
        <input 
          type="text" 
          bind:value={configStore.config.agent.name}
          onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
          class="bg-white dark:bg-[#2C2C2E] border border-gray-300 dark:border-white/20 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-[#007AFF]/20 focus:border-[#007AFF] hover:border-gray-400 dark:hover:border-white/30 w-[240px] text-right transition-colors"
        />
      </div>

    </div>
  </div>

  <div>
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Trading Parameters</div>
    <div class="flex flex-col bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Default Chain</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Primary blockchain network.</div>
        </div>
        <Dropdown 
          bind:value={configStore.config.agent.default_chain}
          onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
          options={[
            {value: 'all', label: 'All Chain', provider: 'globe'},
            {value: 'ethereum', label: 'Ethereum Mainnet', iconUrl: getChainLogoUrl('ethereum')},
            {value: 'bsc', label: 'BNB Chain', iconUrl: getChainLogoUrl('bsc')},
            {value: 'base', label: 'Base', iconUrl: getChainLogoUrl('base')},
            {value: 'arbitrum', label: 'Arbitrum One', iconUrl: getChainLogoUrl('arbitrum')},
            {value: 'robinhood', label: 'Robinhood Chain', iconUrl: getChainLogoUrl('robinhood')},
            {value: 'optimism', label: 'OP Mainnet', iconUrl: getChainLogoUrl('optimism')},
            {value: 'polygon', label: 'Polygon (Matic)', iconUrl: getChainLogoUrl('polygon')},
            {value: 'sepolia', label: 'Sepolia Testnet', iconUrl: getChainLogoUrl('sepolia')},
            {value: 'base_sepolia', label: 'Base Sepolia', iconUrl: getChainLogoUrl('base_sepolia')},
            {value: 'arbitrum_sepolia', label: 'Arbitrum Sepolia', iconUrl: getChainLogoUrl('arbitrum_sepolia')},
            {value: 'robinhood_testnet', label: 'Robinhood Testnet', iconUrl: getChainLogoUrl('robinhood_testnet')},
            {value: 'optimism_sepolia', label: 'OP Sepolia', iconUrl: getChainLogoUrl('optimism_sepolia')}
          ]}
          className="min-w-[160px]"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Default Slippage</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Maximum allowed slippage for swaps.</div>
        </div>
        <div class="flex items-center gap-2">
          <input 
            type="text" 
            value={configStore.config.agent.default_slippage ?? 'auto'}
            oninput={(e) => {
              const val = e.currentTarget.value;
              if (val.toLowerCase() === 'auto' || val === '') {
                configStore.config.agent.default_slippage = 'auto';
              } else {
                const num = parseFloat(val);
                configStore.config.agent.default_slippage = isNaN(num) ? 'auto' : num;
              }
            }}
            onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
            placeholder="e.g. 0.5 or auto"
            class="bg-white dark:bg-[#2C2C2E] border border-gray-300 dark:border-white/20 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-[#007AFF]/20 focus:border-[#007AFF] hover:border-gray-400 dark:hover:border-white/30 w-[120px] text-right transition-colors"
          />
          <span class="text-[13px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#2C2C2E]/50 px-2 py-1.5 rounded-md border border-gray-200 dark:border-white/10">%</span>
        </div>
      </div>

    </div>
  </div>

</div>
{/if}
