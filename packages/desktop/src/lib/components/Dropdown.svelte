<script lang="ts">
  import { fade } from 'svelte/transition';
  import { tick } from 'svelte';
  import LlmIcon from './LlmIcon.svelte';

  let { 
    value = $bindable(), 
    options = [], 
    onchange = () => {},
    className = "" 
  } = $props<{
    value: string | number;
    options: {value: string | number, label: string, iconUrl?: string, provider?: string}[];
    onchange?: (val: string | number) => void;
    className?: string;
  }>();

  let isOpen = $state(false);

  const selectedOption = $derived(options.find(o => o.value === value));
  const selectedLabel = $derived(selectedOption?.label || (value !== undefined && value !== null && value !== '' ? value : 'Select...'));

  async function handleSelect(val: string | number) {
    value = val;
    isOpen = false;
    await tick();
    if (onchange) onchange(val);
  }
</script>

<div class="relative inline-block {className}">
  <button 
    onclick={() => isOpen = !isOpen}
    class="w-full flex items-center justify-between bg-[#0A84FF] hover:bg-[#0070E0] dark:bg-[#007AFF] dark:hover:bg-[#0062CC] text-white border-none rounded-full px-4 py-2 text-[13.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50 cursor-pointer transition-all shadow-sm"
  >
    <div class="flex items-center gap-2 truncate">
      {#if selectedOption?.iconUrl}
        <img src={selectedOption.iconUrl} alt="icon" class="w-4 h-4 rounded-full object-cover shrink-0" />
      {:else if selectedOption?.provider}
        <LlmIcon provider={selectedOption.provider} size={14} color="currentColor" />
      {/if}
      <span class="truncate">{selectedLabel}</span>
    </div>
    <svg class="w-4 h-4 text-white/80 shrink-0 ml-3 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if isOpen}
    <!-- Invisible overlay to detect outside clicks -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="fixed inset-0 z-40" 
      onclick={() => isOpen = false}
    ></div>
    
    <div 
      transition:fade={{duration: 100}}
      class="absolute right-0 top-full mt-1.5 min-w-[100%] z-50 bg-white/95 dark:bg-[#27272a]/95 backdrop-blur-xl border border-gray-200/80 dark:border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] overflow-hidden"
    >
      <div class="max-h-[250px] overflow-y-auto scrollbar-none py-1.5">
        {#each options as option}
          <button
            onclick={() => handleSelect(option.value)}
            class="w-full flex items-center gap-2 text-left px-4 py-2 text-[13.5px] whitespace-nowrap transition-colors {value === option.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}"
          >
            {#if option.iconUrl}
              <img src={option.iconUrl} alt="icon" class="w-4 h-4 rounded-full object-cover shrink-0" />
            {:else if option.provider}
              <LlmIcon provider={option.provider} size={14} color="currentColor" />
            {/if}
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
