<script lang="ts">
  import { onMount } from 'svelte';
  import { KeyRound, ShieldAlert, CheckCircle2, Save, Eye, EyeOff } from '@lucide/svelte';
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

<div class="space-y-7 w-full">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Market Oracles Configuration</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">These keys are used for market intelligence, price fetching, and portfolio analysis.</p>

    <div class="bg-amber-50/80 dark:bg-amber-900/15 border border-amber-200/80 dark:border-amber-900/40 p-4 rounded-2xl mb-5 flex gap-3.5 items-start">
      <ShieldAlert size={20} class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <p class="m-0 text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
        <strong class="text-amber-900 dark:text-amber-300 font-bold">Security Notice:</strong> Your keys are stored in plain text locally inside 
        <code class="bg-amber-100/80 dark:bg-black/30 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-400 font-mono">~/.nyxora/config/market_keys.yaml</code>. 
        They are highly isolated and never transmitted except directly to the respective Oracle API.
      </p>
    </div>

    {#if status}
      <div class="bg-green-50/80 dark:bg-green-900/20 border border-green-200/80 dark:border-green-900/40 text-green-700 dark:text-green-300 p-3.5 rounded-2xl mb-5 flex items-center gap-2.5 text-xs font-medium">
        <CheckCircle2 size={16} /> <span>{status}</span>
      </div>
    {/if}

    <div class="mb-2">
      <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Market Intelligence Providers</div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-4 px-1">If not provided, Nyxora will gracefully fallback to public APIs (CoinGecko Public / DexScreener).</p>
      
      {#if requirements.length === 0}
        <div class="text-center text-gray-500 py-10 border border-dashed border-gray-200/80 dark:border-white/10 rounded-2xl text-xs">
          No API Keys required by currently active providers.
        </div>
      {:else}
        <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-200/60 dark:divide-white/10">
          {#each requirements as req (req.id)}
            <div class="p-4 flex gap-4 items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
              
              <div class="w-[230px] flex-shrink-0 flex gap-3 items-start">
                <!-- svelte-ignore a11y_missing_attribute -->
                <img 
                  src={getRouterLogoUrl(req.id)} 
                  class="w-7 h-7 rounded-full mt-0.5 bg-gray-100 dark:bg-white/5 p-0.5"
                  onerror={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <strong class="text-gray-900 dark:text-gray-100 text-xs font-semibold truncate">{req.label}</strong>
                    {#if req.configured}
                      <span class="text-green-600 dark:text-green-400 text-[0.65rem] flex items-center gap-1 font-semibold bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                        <CheckCircle2 size={11}/> CONFIGURED
                      </span>
                    {/if}
                  </div>
                  <span class="text-gray-400 dark:text-gray-500 text-[0.7rem] leading-snug block">
                    {req.required ? 'Required' : 'Optional'} API Key.
                    {#if req.docsUrl}
                      <a href={req.docsUrl} target="_blank" rel="noreferrer" class="ml-1 text-blue-500 hover:underline">Get Key</a>
                    {/if}
                  </span>
                </div>
              </div>
              
              <div class="flex-1 flex gap-2 items-center">
                <div class="relative flex-1">
                  <input
                    type={showKey[req.id] ? "text" : "password"}
                    class="w-full bg-gray-100/80 dark:bg-black/30 border {req.configured ? 'border-green-500/40' : 'border-gray-200/50 dark:border-white/10'} rounded-xl pr-9 pl-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    placeholder={req.configured ? "••••••••••••••••" : "Paste API Key here..."}
                    bind:value={inputValues[req.id]}
                  />
                  <button 
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    onclick={() => showKey[req.id] = !showKey[req.id]}
                  >
                    {#if showKey[req.id]}
                      <EyeOff size={14} />
                    {:else}
                      <Eye size={14} />
                    {/if}
                  </button>
                </div>
                
                <button 
                  class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm"
                  onclick={() => handleSave(req.id)}
                  disabled={!inputValues[req.id] || isSaving[req.id]}
                >
                  {#if isSaving[req.id]}
                    <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {:else}
                    <Save size={13} /> Save
                  {/if}
                </button>
                
                {#if req.configured}
                  <button 
                    class="px-3.5 py-1.5 bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-medium disabled:opacity-50 transition-colors"
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
      {/if}
    </div>
  </div>
</div>

