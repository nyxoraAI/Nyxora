<script lang="ts">
  import { fade } from 'svelte/transition';
  import { tick } from 'svelte';

  let { 
    value = $bindable(), 
    options = [], 
    onchange = () => {},
    className = "" 
  } = $props<{
    value: string | number;
    options: {value: string | number, label: string}[];
    onchange?: (val: string | number) => void;
    className?: string;
  }>();

  let isOpen = $state(false);

  const selectedLabel = $derived(options.find(o => o.value === value)?.label || (value !== undefined && value !== null && value !== '' ? value : 'Select...'));

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
    class="w-full flex items-center justify-between bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
  >
    <span class="truncate">{selectedLabel}</span>
    <svg class="w-4 h-4 text-gray-500 shrink-0 ml-3 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            class="w-full text-left px-4 py-2 text-[0.85rem] whitespace-nowrap transition-colors {value === option.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}"
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
