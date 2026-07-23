<script lang="ts">
  import { Wallet, RefreshCw, AlertTriangle, Copy, Check, Plus, X, Trash2 } from 'lucide-svelte';
  import { formatUnits } from 'viem';
  import { getChainLogoUrl, getTokenLogoUrl } from '$lib/utils/logos';
  import NetworkSelector from './NetworkSelector.svelte';
  import { walletStore } from '$lib/stores/wallet';
  import { apiFetch } from '$lib/utils/api';
  import { onMount } from 'svelte';

  let { baseFiat = 'usd' } = $props<{ baseFiat?: string }>();

  let exchangeRate = $state(1);
  let selectedChain = $state('all');

  onMount(() => {
    const savedChain = localStorage.getItem('nyxora_wallet_chain');
    if (savedChain) {
      selectedChain = savedChain;
    }
  });

  $effect(() => {
    localStorage.setItem('nyxora_wallet_chain', selectedChain);
  });
  let copied = $state(false);

  // Whitelist state
  let whitelist = $state<any[]>([]);
  let showModal = $state(false);
  let customCa = $state('');
  let customChain = $state('ethereum');
  let customSymbol = $state('');
  let customDecimals = $state('');
  let fetchingMetadata = $state(false);
  let addingCustom = $state(false);

  let data = $derived($walletStore.data);
  let walletAddress = $derived($walletStore.walletAddress);
  let loading = $derived($walletStore.isLoading);
  let error = $derived($walletStore.error);

  $effect(() => {
    if (baseFiat.toLowerCase() === 'usd') {
      exchangeRate = 1;
      return;
    }
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${baseFiat.toLowerCase()}`)
      .then(res => res.json())
      .then(d => {
        const rate = d.tether?.[baseFiat.toLowerCase()];
        if (rate) exchangeRate = rate;
      })
      .catch(err => console.error('Failed to fetch exchange rate', err));
  });

  let fiatSymbol = $derived.by(() => {
    const f = baseFiat.toLowerCase();
    if (f === 'idr') return 'Rp ';
    if (f === 'eur') return '€';
    if (f === 'jpy') return '¥';
    if (f === 'gbp') return '£';
    if (f === 'aud') return 'A$';
    if (f === 'krw') return '₩';
    if (f === 'inr') return '₹';
    if (f === 'cny') return '¥';
    return '$';
  });

  const fetchWhitelist = async () => {
    if (!walletAddress) return;
    try {
      const res = await apiFetch('/api/portfolio/whitelist');
      if (res.ok) {
        const wlData = await res.json();
        if (wlData[walletAddress.toLowerCase()]) {
          whitelist = wlData[walletAddress.toLowerCase()];
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefresh = async () => {
    await walletStore.fetchPortfolio();
    await fetchWhitelist();
  };

  onMount(() => {
    handleRefresh();
  });

  $effect(() => {
    if (walletAddress && whitelist.length === 0) {
      fetchWhitelist();
    }
  });

  const getChainColor = (chain: string) => {
    const map: Record<string, string> = {
      ethereum: '#627EEA',
      base: '#0052FF',
      arbitrum: '#28A0F0',
      optimism: '#FF0420',
      bsc: '#F0B90B',
      polygon: '#8247E5',
    };
    return map[chain.toLowerCase()] || '#3b82f6';
  };

  const getParsedBalance = (raw: string, decimals: number) => {
    if (decimals === -1) decimals = 18;
    try {
      return parseFloat(formatUnits(BigInt(raw), decimals));
    } catch {
      return 0;
    }
  };

  const formatBalance = (raw: string, decimals: number) => {
    const num = getParsedBalance(raw, decimals);
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  };

  let flatTokens = $derived.by(() => {
    if (!data) return [];
    let tokens: any[] = [];
    Object.entries(data).forEach(([chain, chainTokens]) => {
      chainTokens.forEach(t => {
        tokens.push({ ...t, chain });
      });
    });

    if (selectedChain !== 'all') {
      tokens = tokens.filter(t => t.chain.toLowerCase() === selectedChain.toLowerCase());
    }

    tokens.sort((a, b) => {
      const valA = (a.priceUsd || 0) * getParsedBalance(a.balanceRaw, a.decimals);
      const valB = (b.priceUsd || 0) * getParsedBalance(b.balanceRaw, b.decimals);
      return valB - valA;
    });

    return tokens;
  });

  let totalStats = $derived.by(() => {
    let sum = 0;
    let changeSum = 0;
    flatTokens.forEach(t => {
      const val = (t.priceUsd || 0) * getParsedBalance(t.balanceRaw, t.decimals);
      sum += val;
      changeSum += val * (t.priceChange24h || 0);
    });
    return { 
      totalUsd: sum, 
      totalChange: sum > 0 ? changeSum / sum : 0 
    };
  });

  async function handleCaChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    customCa = val;
    customSymbol = '';
    customDecimals = '';

    if (val.startsWith('0x') && val.length === 42) {
      fetchingMetadata = true;
      try {
        const res = await apiFetch(`/api/portfolio/token-metadata?chain=${customChain}&address=${val}`);
        if (res.ok) {
          const meta = await res.json();
          customSymbol = meta.symbol;
          customDecimals = meta.decimals.toString();
        }
      } catch (err) {
        console.error('Failed to fetch metadata', err);
      } finally {
        fetchingMetadata = false;
      }
    }
  }

  async function handleAddCustomToken() {
    if (!customCa || !customSymbol) return;
    addingCustom = true;
    try {
      await apiFetch('/api/portfolio/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          chainName: customChain,
          tokenAddress: customCa,
          symbol: customSymbol,
          decimals: parseInt(customDecimals) || 18
        })
      });
      showModal = false;
      customCa = '';
      customSymbol = '';
      customDecimals = '';
      await handleRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      addingCustom = false;
    }
  }

  async function handleRemoveToken(chainName: string, tokenAddress: string) {
    try {
      await apiFetch('/api/portfolio/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, chainName, tokenAddress })
      });
      await handleRefresh();
    } catch (err) {
      console.error(err);
    }
  }
</script>

<div class="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900 pb-10">
  <div class="flex flex-wrap justify-between items-start mb-8 gap-6">
    <div>
      <h1 class="flex items-center gap-2 mb-2 text-2xl font-bold">
        <Wallet class="text-blue-500" /> Wallet Scanner
      </h1>
      
      {#if walletAddress}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          onclick={copyAddress}
          class="inline-flex items-center gap-2 bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] px-3 py-1 rounded-xl cursor-pointer text-sm font-mono hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        >
          {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
          {#if copied}
            <Check size={14} class="text-green-500" />
          {:else}
            <Copy size={14} />
          {/if}
        </div>
      {/if}

      <div class="text-4xl font-bold mt-6 flex items-baseline gap-3">
        {fiatSymbol}{(totalStats.totalUsd * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span class="text-base font-medium {totalStats.totalChange >= 0 ? 'text-green-500' : 'text-red-500'}">
          {totalStats.totalChange >= 0 ? '+' : ''}{totalStats.totalChange.toFixed(2)}%
        </span>
      </div>
    </div>
    
    <div class="flex gap-3 items-center">
      <button 
        onclick={() => showModal = true}
        class="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-[#48484a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3a3c] transition-colors font-semibold text-sm"
      >
        <Plus size={16} /> Add Custom Crypto
      </button>

      <NetworkSelector 
        bind:value={selectedChain}
        showAllOption={true}
      />

      <button 
        onclick={handleRefresh} 
        disabled={loading}
        class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={16} class={loading ? 'animate-spin' : ''} /> {loading ? 'Scanning...' : 'Refresh'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 flex items-center gap-2 mb-6">
      <AlertTriangle size={20} /> {error}
    </div>
  {/if}

  {#if !data && loading}
    <div class="text-center p-16 text-blue-500 flex items-center justify-center gap-2">
      <div class="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
      Scanning blockchains...
    </div>
  {/if}

  {#if data && flatTokens.length > 0}
    <div class="bg-white dark:bg-[#1d1d1f] rounded-2xl border border-gray-200 dark:border-[#48484a] overflow-hidden shadow-sm mb-8">
      <div class="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-[#48484a] text-xs font-bold text-gray-500 tracking-wider">
        <div>TOKEN</div>
        <div class="text-right">PRICE</div>
        <div class="text-right">AMOUNT</div>
        <div class="text-right">VALUE ({baseFiat.toUpperCase()})</div>
      </div>
      
      <div class="flex flex-col">
        {#each flatTokens as t, idx}
          {@const usdVal = (t.priceUsd || 0) * getParsedBalance(t.balanceRaw, t.decimals)}
          <div class="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors border-b border-gray-100 dark:border-[#48484a] last:border-0">
            <div class="flex items-center gap-3">
              <div class="relative w-10 h-10">
                <div class="w-full h-full rounded-full flex items-center justify-center font-bold text-sm overflow-hidden {t.isNative ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}">
                  <span class="absolute z-10">{t.symbol.substring(0, 3)}</span>
                  <img 
                    src={getTokenLogoUrl(t.chain, t.address, t.isNative)} 
                    alt={t.symbol} 
                    class="w-full h-full object-cover relative z-20 bg-white dark:bg-[#1d1d1f]" 
                    onerror={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                
                <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-[#1d1d1f] flex items-center justify-center z-30 p-0.5">
                  <div class="w-full h-full rounded-full overflow-hidden" style="background: {getChainColor(t.chain)}">
                    <img 
                      src={getChainLogoUrl(t.chain)} 
                      alt={t.chain} 
                      class="w-full h-full object-cover" 
                      onerror={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                </div>
              </div>
              <span class="font-semibold text-lg">{t.symbol}</span>
            </div>
            
            <div class="text-right font-medium text-gray-500">
              {t.priceUsd ? `${fiatSymbol}${(t.priceUsd * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '-'}
            </div>
            
            <div class="text-right font-semibold">
              {formatBalance(t.balanceRaw, t.decimals)} <span class="text-sm font-normal text-gray-500">{t.symbol}</span>
            </div>
            
            <div class="text-right font-semibold text-lg text-green-500">
              {usdVal > 0 ? `${fiatSymbol}${(usdVal * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${fiatSymbol}0.00`}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if whitelist.length > 0}
    <div class="mt-8">
      <h2 class="text-xl font-bold mb-4">Whitelisted Tokens</h2>
      <div class="bg-white dark:bg-[#1d1d1f] rounded-2xl border border-gray-200 dark:border-[#48484a] overflow-hidden shadow-sm">
        {#each whitelist as t, idx}
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#48484a] last:border-0">
            <div class="flex items-center gap-4">
              <div class="w-6 h-6 rounded-full overflow-hidden" style="background: {getChainColor(t.chainName)}">
                <img src={getChainLogoUrl(t.chainName)} class="w-full h-full object-cover" alt={t.chainName} />
              </div>
              <div>
                <div class="font-bold">{t.symbol || 'Unknown'}</div>
                <div class="text-xs text-gray-500 font-mono">{t.address}</div>
              </div>
            </div>
            <button 
              onclick={() => handleRemoveToken(t.chainName, t.address)}
              class="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if showModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000]" onclick={() => showModal = false}>
      <div class="bg-white dark:bg-[#1d1d1f] w-full max-w-md rounded-2xl p-6 border border-gray-200 dark:border-[#48484a] shadow-2xl" onclick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-6">
          <button onclick={() => showModal = false} class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <X size={20} />
          </button>
          <h2 class="text-xl font-bold m-0">Custom crypto</h2>
          <div class="w-5"></div>
        </div>

        <div class="mb-4">
          <label class="block mb-2 text-sm font-bold">Network</label>
          <NetworkSelector bind:value={customChain} showAllOption={false} />
        </div>

        <div class="mb-4">
          <label class="block mb-2 text-sm font-bold">Contract address</label>
          <input 
            type="text" 
            bind:value={customCa}
            oninput={handleCaChange}
            placeholder="Enter contract information"
            class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-[#48484a] px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div class="mb-4">
          <label class="block mb-2 text-sm font-bold">Symbol</label>
          <div class="relative">
            <input 
              type="text" 
              bind:value={customSymbol}
              readonly
              placeholder={fetchingMetadata ? "Fetching..." : ""}
              class="w-full bg-gray-100 dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] px-4 py-3 rounded-xl outline-none opacity-70"
            />
            {#if fetchingMetadata}
              <div class="absolute right-4 top-4 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            {/if}
          </div>
        </div>

        <div class="mb-6">
          <label class="block mb-2 text-sm font-bold">Decimal</label>
          <input 
            type="text" 
            bind:value={customDecimals}
            readonly
            placeholder={fetchingMetadata ? "Fetching..." : ""}
            class="w-full bg-gray-100 dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] px-4 py-3 rounded-xl outline-none opacity-70"
          />
        </div>

        <button 
          onclick={handleAddCustomToken}
          disabled={!customSymbol || addingCustom}
          class="w-full py-3.5 rounded-full font-bold text-base transition-colors disabled:cursor-not-allowed {(!customSymbol || addingCustom) ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'}"
        >
          {addingCustom ? 'Confirming...' : 'Confirm'}
        </button>
      </div>
    </div>
  {/if}
</div>
