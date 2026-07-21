<script lang="ts">
  import { ChevronRight, Terminal, Search, Activity, Cpu } from 'lucide-svelte';

  interface Props {
    toolCalls?: any[];
    progressLogs?: { text: string; time: number }[];
    isStreaming?: boolean;
    reasoningContent?: string;
    durationMs?: number;
  }

  let { 
    toolCalls = [], 
    progressLogs = [], 
    isStreaming = false, 
    reasoningContent = '',
    durationMs = 0
  }: Props = $props();

  let isOpen = $state(false);
  let startTime = Date.now();
  let elapsedTime = $state(0);
  let intervalId: number | null = null;

  // Auto expand when streaming starts
  $effect(() => {
    if (isStreaming && (toolCalls.length > 0 || progressLogs.length > 0 || reasoningContent)) {
      isOpen = true;
    }
  });

  // Track time if streaming
  $effect(() => {
    if (isStreaming) {
      intervalId = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      }, 1000);
    } else {
      if (intervalId) clearInterval(intervalId);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });

  const hasContent = $derived(toolCalls.length > 0 || progressLogs.length > 0 || reasoningContent);

  function getSummaryText() {
    if (isStreaming) {
      return `Working for ${elapsedTime}s`;
    }
    if (elapsedTime > 0) {
      return `Worked for ${elapsedTime}s`;
    }
    if (durationMs > 0) {
      return `Worked for ${Math.max(1, Math.round(durationMs / 1000))}s`;
    }
    if (progressLogs.length > 1) {
      const firstTime = progressLogs[0].time;
      const lastTime = progressLogs[progressLogs.length - 1].time;
      const seconds = Math.max(1, Math.round((lastTime - firstTime) / 1000));
      return `Worked for ${seconds}s`;
    }
    return `Completed`;
  }

  function getIconForStep(text: string) {
    const lower = text.toLowerCase();
    if (lower.includes('find') || lower.includes('search') || lower.includes('explored')) return 'search';
    if (lower.includes('ran') || lower.includes('running') || lower.includes('execute')) return 'terminal';
    if (lower.includes('thought')) return 'cpu';
    return 'activity';
  }

  // Merge history tool_calls into readable strings if progressLogs is empty
  const traces = $derived(() => {
    const result: string[] = [];
    
    if (progressLogs && progressLogs.length > 0) {
      progressLogs.forEach(log => {
        const cleanText = log.text.replace(/<[^>]*>?/gm, '').replace(/\*+/g, '').trim();
        if (cleanText) result.push(cleanText);
      });
    } else if (toolCalls && toolCalls.length > 0) {
      toolCalls.forEach(tool => {
        result.push(`Ran ${tool.function?.name || 'tool'}`);
      });
    }
    
    return result;
  });
</script>

{#if hasContent}
  <div class="-mb-1">
    <button
      onclick={() => isOpen = !isOpen}
      class="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:text-[#d8dee9] dark:hover:text-gray-200 transition-colors cursor-pointer w-fit"
    >
      <span class="text-[13px] font-medium">
        {getSummaryText()}
      </span>
      <div class="transition-transform duration-200 flex items-center" style="transform: {isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </button>
    
    {#if isOpen}
      <div class="mt-2 pl-4 ml-3 border-l-[1.5px] border-gray-100 dark:border-[#434c5e] flex flex-col gap-3 py-1">
        {#if reasoningContent}
          <div class="flex items-start gap-3 text-sm text-gray-600 dark:text-[#d8dee9]">
            <Cpu size={15} class="text-pink-400 mt-0.5 flex-shrink-0" />
            <div class="flex-1">
              <span class="font-medium text-gray-700 dark:text-[#d8dee9]">Thinking:</span>
              <p class="mt-1 text-[13px] leading-relaxed italic whitespace-pre-wrap">{reasoningContent}</p>
            </div>
          </div>
        {/if}
        
        {#each traces() as trace, idx}
          <div class="flex items-center gap-3 text-[14px] text-slate-500 dark:text-[#d8dee9]">
            {#if getIconForStep(trace) === 'search'}
              <Search size={15} class="text-blue-400 stroke-[1.5]" />
            {:else if getIconForStep(trace) === 'terminal'}
              <Terminal size={15} class="text-green-500 stroke-[1.5]" />
            {:else if getIconForStep(trace) === 'cpu'}
              <Cpu size={15} class="text-pink-400 stroke-[1.5]" />
            {:else}
              <Activity size={15} class="text-gray-400 stroke-[1.5]" />
            {/if}
            <span class="font-medium">{trace}</span>
          </div>
        {/each}
        
        {#if isStreaming}
          <div class="flex items-center gap-3 text-[14px] text-slate-500 dark:text-[#d8dee9]">
            <Activity size={15} class="text-gray-400 animate-pulse stroke-[1.5]" />
            <span class="animate-pulse font-medium working-dots">Working</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
