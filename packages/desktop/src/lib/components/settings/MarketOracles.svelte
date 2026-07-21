<script lang="ts">
  import { onMount } from 'svelte';
  import { KeyRound, ShieldAlert, CheckCircle2, Save, Eye, EyeOff } from 'lucide-svelte';
  import { apiFetch } from '$lib/utils/api';
  import { getRouterLogoUrl } from '$lib/utils/logos';

  interface ApiKeyRequirement {
    id: string;
    label: string;
    required: boolean;
    docsUrl?: string;
    configured: boolean;
  }

  let requirements = $state<ApiKeyRequirement[]>([]);
  let inputValues = $state<Record<string, string>>({});
  let showKey = $state<Record<string, boolean>>({});
  let status = $state<string | null>(null);
  let isSaving = $state<Record<string, boolean>>({});
  let isDeleting = $state<Record<string, boolean>>({});

  onMount(async () => {
    try {
      const res = await apiFetch('/api/market-keys');
      const data = await res.json();
      if (data.requirements) {
        requirements = data.requirements;
      }
    } catch (err) {
      console.error("Failed to fetch market keys", err);
    }
  });

  async function handleSave(id: string) {
    const value = inputValues[id];
    if (!value) return;

    isSaving[id] = true;
    try {
      const payload = { [id]: value };
      const res = await apiFetch('/api/market-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        status = 'Saved successfully!';
        requirements = requirements.map(r => r.id === id ? { ...r, configured: true } : r);
        
        inputValues = { ...inputValues };
        delete inputValues[id];
        
        setTimeout(() => status = null, 3000);
      } else {
        status = 'Failed to save key';
      }
    } catch (err) {
      status = 'Failed to save key';
    } finally {
      isSaving[id] = false;
    }
  }

  async function handleDelete(id: string) {
    isDeleting[id] = true;
    try {
      const res = await apiFetch(`/api/market-keys/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        status = 'Key deleted successfully!';
        requirements = requirements.map(r => r.id === id ? { ...r, configured: false } : r);
        setTimeout(() => status = null, 3000);
      } else {
        status = 'Failed to delete key';
      }
    } catch (err) {
      status = 'Failed to delete key';
    } finally {
      isDeleting[id] = false;
    }
  }
</script>

<div class="space-y-8 w-full">
  <div>
    <div class="flex items-center gap-3 mb-1">
      <KeyRound size={24} class="text-blue-500" />
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Market Oracles Configuration</h2>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">These keys are used for market intelligence, price fetching, and portfolio analysis.</p>

    <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 p-4 rounded-xl mb-8 flex gap-4 items-start">
      <ShieldAlert size={24} class="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
      <p class="m-0 text-[0.85rem] text-yellow-800 dark:text-yellow-200/80 leading-relaxed">
        <strong class="text-yellow-900 dark:text-yellow-500 font-semibold">Security Notice:</strong> Your keys are stored in plain text locally inside 
        <code class="bg-yellow-100 dark:bg-black/20 px-1.5 py-0.5 rounded text-yellow-900 dark:text-yellow-400">~/.nyxora/config/market_keys.yaml</code>. 
        They are highly isolated and never transmitted except directly to the respective Oracle API.
      </p>
    </div>

    {#if status}
      <div class="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400 p-3.5 rounded-xl mb-6 flex items-center gap-3 text-sm">
        <CheckCircle2 size={18} /> <strong>{status}</strong>
      </div>
    {/if}

    <div class="mb-4">
      <h3 class="text-lg font-medium text-blue-600 dark:text-blue-400 mb-2">Market Intelligence Providers</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">If not provided, Nyxora will gracefully fallback to public APIs (CoinGecko Public / DexScreener).</p>
      
      {#if requirements.length === 0}
        <div class="text-center text-gray-500 py-10 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
          No API Keys required by currently active providers.
        </div>
      {/if}

      <div class="space-y-4">
        {#each requirements as req (req.id)}
          <div class="bg-white dark:bg-[#27272a]/50 p-5 rounded-xl border border-gray-200 dark:border-white/10 flex gap-6 items-center">
            
            <div class="w-[280px] flex-shrink-0 flex gap-3 items-start">
              <!-- svelte-ignore a11y_missing_attribute -->
              <img 
                src={getRouterLogoUrl(req.id)} 
                class="w-8 h-8 rounded-full mt-0.5"
                onerror={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div class="flex-1">
                <div class="flex justify-between items-center mb-1">
                  <strong class="text-gray-900 dark:text-gray-100 text-[0.95rem]">{req.label}</strong>
                  {#if req.configured}
                    <span class="text-green-600 dark:text-green-400 text-[0.7rem] flex items-center gap-1 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12}/> CONFIGURED
                    </span>
                  {/if}
                </div>
                <span class="text-gray-500 text-[0.8rem] leading-snug block">
                  {req.required ? 'Required' : 'Optional'} API Key.
                  {#if req.docsUrl}
                    <a href={req.docsUrl} target="_blank" rel="noreferrer" class="ml-1 text-blue-500 hover:underline">Get Key</a>
                  {/if}
                </span>
              </div>
            </div>
            
            <div class="flex-1 flex gap-3 items-center">
              <div class="relative flex-1">
                <input
                  type={showKey[req.id] ? "text" : "password"}
                  class="w-full bg-gray-50 dark:bg-[#18181b]/50 border {req.configured ? 'border-green-500/50' : 'border-gray-200 dark:border-white/10'} rounded-lg pr-10 pl-3 py-2 text-[0.85rem] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={req.configured ? "••••••••••••••••" : "Paste API Key here..."}
                  bind:value={inputValues[req.id]}
                />
                <button 
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onclick={() => showKey[req.id] = !showKey[req.id]}
                >
                  {#if showKey[req.id]}
                    <EyeOff size={16} />
                  {:else}
                    <Eye size={16} />
                  {/if}
                </button>
              </div>
              
              <button 
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                onclick={() => handleSave(req.id)}
                disabled={!inputValues[req.id] || isSaving[req.id]}
              >
                {#if isSaving[req.id]}
                  <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {:else}
                  <Save size={14} /> Save
                {/if}
              </button>
              
              {#if req.configured}
                <button 
                  class="px-4 py-2 bg-transparent border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  onclick={() => handleDelete(req.id)}
                  disabled={isDeleting[req.id]}
                >
                  {#if isDeleting[req.id]}
                    <div class="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                  {:else}
                    Delete
                  {/if}
                </button>
              {/if}
            </div>
            
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
