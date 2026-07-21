<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import Dropdown from '../Dropdown.svelte';
</script>

{#if configStore.config}
<div class="space-y-8 w-full">
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Agent Profile</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure the core identity and behavior parameters of your agent.</p>
    
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">Identity</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Agent Name</div>
          <div class="text-[0.75rem] text-gray-500">The displayed name of your agent.</div>
        </div>
        <input 
          type="text" 
          bind:value={configStore.config.agent.name}
          onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
          class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[240px] text-right"
        />
      </div>

    </div>
  </div>

  <div>
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">Trading Parameters</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Default Chain</div>
          <div class="text-[0.75rem] text-gray-500">Primary blockchain network.</div>
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

      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Default Slippage</div>
          <div class="text-[0.75rem] text-gray-500">Maximum allowed slippage for swaps.</div>
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
            class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px] text-right"
          />
          <span class="text-[0.85rem] text-gray-500 dark:text-gray-400">%</span>
        </div>
      </div>

    </div>
  </div>

  

</div>
{/if}
