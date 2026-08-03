<script lang="ts">
  import { onMount } from 'svelte';
  import { Server, ShieldAlert, CheckCircle2, Save, AlertTriangle } from '@lucide/svelte';
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

<div class="space-y-7 w-full">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">RPC Configuration</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Configure your private RPC URLs (Alchemy, Infura, etc.) for High-Frequency execution.</p>

    <div class="bg-amber-50/80 dark:bg-amber-900/15 border border-amber-200/80 dark:border-amber-900/40 p-4 rounded-2xl mb-5 flex gap-3.5 items-start">
      <ShieldAlert size={20} class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div class="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
        <strong class="text-amber-900 dark:text-amber-300 font-bold">Privacy & Security:</strong> Your RPC keys are saved in a highly isolated <code class="bg-amber-100/80 dark:bg-black/30 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-400 font-mono">~/.nyxora/config/rpc_key.yaml</code> file. 
        This guarantees that sharing your agent's config or prompts won't accidentally leak your premium node endpoints.
      </div>
    </div>

    {#if status}
      <div class="bg-green-50/80 dark:bg-green-900/20 border border-green-200/80 dark:border-green-900/40 text-green-700 dark:text-green-300 p-3.5 rounded-2xl mb-5 flex items-center gap-2.5 text-xs font-medium">
        <CheckCircle2 size={16} /> <span>{status}</span>
      </div>
    {/if}

    <div class="mb-2">
      <div class="bg-red-50/70 dark:bg-red-900/15 border border-red-200/60 dark:border-red-900/30 text-red-700 dark:text-red-300 px-3.5 py-2.5 rounded-xl mb-5 inline-flex items-center gap-2 text-xs">
        <AlertTriangle size={14} class="flex-shrink-0" /> Leaving a field empty will trigger the Agent's automatic <strong>Public Fallback Mechanism</strong>.
      </div>
      
      <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Network Nodes</div>
      <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-200/60 dark:divide-white/10">
        {#each SUPPORTED_CHAINS as chain (chain.id)}
          <div class="p-4 flex gap-4 items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
            
            <div class="flex gap-3 items-center w-[210px] flex-shrink-0">
              <!-- svelte-ignore a11y_missing_attribute -->
              <img 
                src={getChainLogoUrl(chain.id)} 
                class="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 p-0.5"
                onerror={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div class="min-w-0">
                <strong class="text-gray-900 dark:text-gray-100 text-xs font-semibold block truncate">{chain.name}</strong>
                <span class="text-gray-400 dark:text-gray-500 text-[0.7rem] font-mono block truncate">{chain.id}</span>
              </div>
            </div>
            
            <div class="flex-1 flex gap-2 items-center">
              <input
                type="password"
                class="flex-1 bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="e.g. https://base-mainnet.g.alchemy.com/v2/..."
                bind:value={inputValues[chain.id]}
              />
              <button 
                class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm"
                onclick={() => handleSave(chain.id, inputValues[chain.id])}
                disabled={isSaving[chain.id]}
              >
                {#if isSaving[chain.id]}
                  <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {:else}
                  <Save size={13} /> Save
                {/if}
              </button>
            </div>
            
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

