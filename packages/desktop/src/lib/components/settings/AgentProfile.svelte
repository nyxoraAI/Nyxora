<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import Dropdown from '../Dropdown.svelte';
</script>

{#if configStore.config}
<div class="space-y-7 w-full">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Agent Profile</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Configure the core identity and behavior parameters of your agent.</p>
    
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Identity</div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-3.5 px-5">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Agent Name</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">The displayed name of your agent.</div>
        </div>
        <input 
          type="text" 
          bind:value={configStore.config.agent.name}
          onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
          class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[240px] text-right transition-all"
        />
      </div>

    </div>
  </div>

  <div>
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Trading Parameters</div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Default Chain</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Primary blockchain network.</div>
        </div>
        <Dropdown 
          bind:value={configStore.config.agent.default_chain}
          onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
          options={[
            {value: 'ethereum', label: 'Ethereum Mainnet'},
            {value: 'bsc', label: 'BNB Chain'},
            {value: 'base', label: 'Base'},
            {value: 'arbitrum', label: 'Arbitrum One'},
            {value: 'robinhood', label: 'Robinhood Chain'},
            {value: 'optimism', label: 'OP Mainnet'},
            {value: 'polygon', label: 'Polygon (Matic)'},
            {value: 'sepolia', label: 'Sepolia Testnet'},
            {value: 'base_sepolia', label: 'Base Sepolia'},
            {value: 'arbitrum_sepolia', label: 'Arbitrum Sepolia'},
            {value: 'robinhood_testnet', label: 'Robinhood Testnet'},
            {value: 'optimism_sepolia', label: 'OP Sepolia'}
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
            class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[120px] text-right transition-all"
          />
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">%</span>
        </div>
      </div>

    </div>
  </div>

</div>
{/if}
