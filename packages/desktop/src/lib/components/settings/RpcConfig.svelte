<script lang="ts">
  import { onMount } from 'svelte';
  import { Server, ShieldAlert, CheckCircle2, Save, AlertTriangle } from 'lucide-svelte';
  import { apiFetch } from '$lib/utils/api';
  import { getChainLogoUrl } from '$lib/utils/logos';

  const SUPPORTED_CHAINS = [
    { id: 'ethereum', name: 'Ethereum Mainnet' },
    { id: 'base', name: 'Base Mainnet' },
    { id: 'optimism', name: 'Optimism Mainnet' },
    { id: 'arbitrum', name: 'Arbitrum One' },
    { id: 'robinhood', name: 'Robinhood Chain' },
    { id: 'bsc', name: 'Binance Smart Chain' },
    { id: 'polygon', name: 'Polygon Mainnet' },
    { id: 'sepolia', name: 'Sepolia (Testnet)' },
    { id: 'base_sepolia', name: 'Base Sepolia (Testnet)' },
    { id: 'optimism_sepolia', name: 'OP Sepolia (Testnet)' },
    { id: 'arbitrum_sepolia', name: 'Arbitrum Sepolia (Testnet)' },
    { id: 'robinhood_testnet', name: 'Robinhood Testnet' }
  ];

  let rpcUrls = $state<Record<string, string | string[]>>({});
  let inputValues = $state<Record<string, string>>({});
  let status = $state<string | null>(null);
  let isSaving = $state<Record<string, boolean>>({});

  onMount(async () => {
    try {
      const res = await apiFetch('/api/rpc');
      const data = await res.json();
      rpcUrls = data || {};
      
      // Initialize input values from current RPC array/string
      for (const chain of SUPPORTED_CHAINS) {
        inputValues[chain.id] = getDisplayValue(rpcUrls[chain.id]);
      }
    } catch (err) {
      console.error("Failed to fetch rpc config", err);
    }
  });

  function getDisplayValue(val: string | string[] | undefined): string {
    if (!val) return '';
    if (Array.isArray(val)) return val[0] || '';
    return val;
  }

  async function handleSave(chainId: string, value: string) {
    isSaving[chainId] = true;
    try {
      const payload = { [chainId]: value };
      const res = await apiFetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        status = `Saved RPC for ${chainId} successfully!`;
        rpcUrls[chainId] = value;
        setTimeout(() => status = null, 3000);
      } else {
        status = `Failed to save RPC for ${chainId}`;
      }
    } catch (err) {
      status = `Failed to save RPC for ${chainId}`;
    } finally {
      isSaving[chainId] = false;
    }
  }
</script>

<div class="space-y-8 w-full">
  <div>
    <div class="flex items-center gap-3 mb-1">
      <Server size={24} class="text-blue-500" />
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">RPC Configuration</h2>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure your private RPC URLs (Alchemy, Infura, etc.) for High-Frequency execution.</p>

    <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 p-4 rounded-xl mb-6 flex gap-4 items-start">
      <ShieldAlert size={24} class="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
      <div class="text-[0.85rem] text-yellow-800 dark:text-yellow-200/80 leading-relaxed">
        <strong class="text-yellow-900 dark:text-yellow-500 font-semibold">Privacy & Security:</strong> Your RPC keys are saved in a highly isolated <code class="bg-yellow-100 dark:bg-black/20 px-1.5 py-0.5 rounded text-yellow-900 dark:text-yellow-400">~/.nyxora/config/rpc_key.yaml</code> file. 
        This guarantees that sharing your agent's config or prompts won't accidentally leak your premium node endpoints.
      </div>
    </div>

    {#if status}
      <div class="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400 p-3.5 rounded-xl mb-6 flex items-center gap-3 text-sm">
        <CheckCircle2 size={18} /> <strong>{status}</strong>
      </div>
    {/if}

    <div class="mb-4">
      <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg mb-8 inline-flex items-center gap-2 text-[0.85rem]">
        <AlertTriangle size={16} /> Leaving a field empty will trigger the Agent's automatic <strong>Public Fallback Mechanism</strong>.
      </div>
      
      <div class="space-y-4">
        {#each SUPPORTED_CHAINS as chain (chain.id)}
          <div class="bg-white dark:bg-[#27272a]/50 p-5 rounded-xl border border-gray-200 dark:border-white/10 flex gap-6 items-center">
            
            <div class="flex gap-3 items-center w-[240px] flex-shrink-0">
              <!-- svelte-ignore a11y_missing_attribute -->
              <img 
                src={getChainLogoUrl(chain.id)} 
                class="w-8 h-8 rounded-full"
                onerror={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div>
                <strong class="text-gray-900 dark:text-gray-100 text-[0.95rem] block">{chain.name}</strong>
                <span class="text-gray-500 text-[0.75rem] font-mono">{chain.id}</span>
              </div>
            </div>
            
            <div class="flex-1 flex gap-3">
              <input
                type="password"
                class="flex-1 bg-gray-50 dark:bg-[#18181b]/50 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-[0.85rem] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. https://base-mainnet.g.alchemy.com/v2/..."
                bind:value={inputValues[chain.id]}
              />
              <button 
                class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                onclick={() => handleSave(chain.id, inputValues[chain.id])}
                disabled={isSaving[chain.id]}
              >
                {#if isSaving[chain.id]}
                  <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {:else}
                  <Save size={14} /> Save
                {/if}
              </button>
            </div>
            
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
