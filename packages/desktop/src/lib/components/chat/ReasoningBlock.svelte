<script lang="ts">
  import { ChevronRight, BrainCircuit } from 'lucide-svelte';
  
  let { content = '', isStreaming = false } = $props();
  
  let isExpanded = $state(false);
  let autoCollapsed = $state(false);
  
  // Auto-expand while streaming, auto-collapse when done (once)
  $effect(() => {
    if (isStreaming && !autoCollapsed) {
      isExpanded = true;
    } else if (!isStreaming && !autoCollapsed) {
      isExpanded = false;
      autoCollapsed = true;
    }
  });
</script>

<div class="my-2 rounded-xl bg-gray-50 dark:bg-[#3b4252] border border-gray-200 dark:border-[#434c5e] overflow-hidden text-[15px] transition-all duration-300">
  <button 
    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#434c5e] transition-colors text-left"
    onclick={() => { isExpanded = !isExpanded; autoCollapsed = true; }}
  >
    <div class="text-gray-500 dark:text-[#d8dee9] transition-transform duration-200 flex-shrink-0" class:rotate-90={isExpanded}>
      <ChevronRight size={16} />
    </div>
    
    <div class="flex items-center gap-2">
      {#if isStreaming}
        <BrainCircuit size={16} class="text-gray-500 dark:text-[#d8dee9] animate-pulse" />
        <span class="font-medium text-gray-700 dark:text-[#d8dee9] working-dots">Thinking</span>
      {:else}
        <BrainCircuit size={16} class="text-gray-500 dark:text-[#d8dee9]" />
        <span class="font-medium text-gray-700 dark:text-[#d8dee9]">Thought Process</span>
      {/if}
    </div>
  </button>
  
  {#if isExpanded}
    <div class="px-5 pb-4 pt-1 text-gray-600 dark:text-[#d8dee9] border-t border-gray-200 dark:border-[#434c5e]/50 bg-white dark:bg-[#2e3440]">
      <div class="prose dark:prose-invert prose-sm max-w-none whitespace-pre-wrap border-l-[3px] border-gray-300 dark:border-[#4c566a] pl-4 py-1 italic mt-3 font-serif">
        {content.trim()}
      </div>
    </div>
  {/if}
</div>
