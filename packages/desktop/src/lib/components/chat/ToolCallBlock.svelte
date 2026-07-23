<script lang="ts">
  import { ChevronRight, Wrench } from 'lucide-svelte';
  
  let { content = '', isStreaming = false } = $props();
  
  let isExpanded = $state(false);
  let parsedTool = $state<any>(null);
  let autoCollapsed = $state(false);

  $effect(() => {
    if (!isStreaming) {
      try {
        parsedTool = JSON.parse(content);
        if (!autoCollapsed) {
          isExpanded = false;
          autoCollapsed = true;
        }
      } catch (e) {
        parsedTool = null;
      }
    } else {
      if (!autoCollapsed) {
        isExpanded = true;
      }
    }
  });
</script>

<div class="my-2 rounded-xl bg-gray-50 dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#3a3a3c] overflow-hidden text-[15px] transition-all duration-300">
  <button 
    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#3a3a3c] transition-colors text-left"
    onclick={() => { isExpanded = !isExpanded; autoCollapsed = true; }}
  >
    <div class="text-gray-500 dark:text-[#e5e5ea] transition-transform duration-200 flex-shrink-0" class:rotate-90={isExpanded}>
      <ChevronRight size={16} />
    </div>
    
    <div class="flex items-center gap-2">
      <Wrench size={16} class="text-blue-500 {isStreaming ? 'animate-pulse' : ''}" />
      <span class="font-medium text-gray-700 dark:text-[#e5e5ea] {isStreaming ? 'working-dots' : ''}">
        {#if isStreaming}
          Executing Tool
        {:else if parsedTool?.tool_name || parsedTool?.function_name}
          Tool Executed: {parsedTool.tool_name || parsedTool.function_name}
        {:else}
          Tool Executed
        {/if}
      </span>
    </div>
  </button>
  
  {#if isExpanded}
    <div class="px-5 pb-4 pt-1 text-gray-600 dark:text-[#e5e5ea] border-t border-gray-200 dark:border-[#3a3a3c]/50 bg-white dark:bg-[#1c1c1e]">
      <pre class="text-xs bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-gray-800 dark:text-[#f5f5f7] mt-3 font-mono shadow-inner border border-gray-200 dark:border-[#3a3a3c]"><code>{content.trim()}</code></pre>
    </div>
  {/if}
</div>
