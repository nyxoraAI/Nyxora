<script lang="ts">
  import { Terminal, Search, Activity, Cpu, FileCode } from 'lucide-svelte';
  import { untrack } from 'svelte';

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
  let startTime = $state<number | null>(null);
  let elapsedTime = $state(0);
  let finalElapsed = $state(0); // frozen snapshot when streaming stops
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Auto expand when streaming starts and there's content
  $effect(() => {
    if (isStreaming && (toolCalls.length > 0 || progressLogs.length > 0 || reasoningContent)) {
      isOpen = true;
    }
  });

  // Timer: start once when streaming begins, stop when it ends
  $effect(() => {
    if (isStreaming) {
      untrack(() => {
        if (startTime === null) {
          startTime = Date.now();
          elapsedTime = 0;
        }
      });

      const interval = setInterval(() => {
        if (startTime !== null) {
          elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        }
      }, 500);

      return () => clearInterval(interval);
    } else {
      untrack(() => {
        if (startTime !== null) {
          const total = Math.floor((Date.now() - startTime) / 1000);
          if (total > 0) finalElapsed = total;
          startTime = null;
        }
      });
    }
  });

  const hasContent = $derived(toolCalls.length > 0 || progressLogs.length > 0 || !!reasoningContent);

  // $derived.by() agar Svelte 5 bisa track elapsedTime / isStreaming / finalElapsed dengan benar
  const summaryText = $derived.by(() => {
    if (isStreaming) {
      return `Working for ${elapsedTime}s`;
    }
    if (durationMs > 0) {
      return `Worked for ${Math.max(1, Math.round(durationMs / 1000))}s`;
    }
    if (finalElapsed > 0) {
      return `Worked for ${finalElapsed}s`;
    }
    if (progressLogs.length > 1) {
      const firstTime = progressLogs[0].time;
      const lastTime = progressLogs[progressLogs.length - 1].time;
      const seconds = Math.max(1, Math.round((lastTime - firstTime) / 1000));
      return `Worked for ${seconds}s`;
    }
    return `Completed`;
  });

  function getIconForStep(text: string) {
    const lower = text.toLowerCase();
    if (lower.includes('find') || lower.includes('search') || lower.includes('explored')) return 'search';
    if (lower.includes('file') || lower.includes('replace') || lower.includes('write')) return 'file';
    if (lower.includes('ran') || lower.includes('running') || lower.includes('execute')) return 'terminal';
    if (lower.includes('thought')) return 'cpu';
    return 'activity';
  }

  // Merge history tool_calls into readable strings if progressLogs is empty
  const traces = $derived.by(() => {
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
      class="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:text-[#e5e5ea] dark:hover:text-gray-200 transition-colors cursor-pointer w-fit"
    >
      <span class="text-[13px] font-medium">
        {summaryText}
      </span>
      <div class="transition-transform duration-200 flex items-center" style="transform: {isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </button>
    
    {#if isOpen}
      <div class="mt-2 pl-4 ml-3 border-l-[1.5px] border-gray-100 dark:border-[#3a3a3c] flex flex-col gap-3 py-1 max-h-[160px] overflow-y-auto pr-2 styled-scroll scroll-smooth overscroll-contain">

        {#if reasoningContent}
          <div class="flex items-start gap-3 text-sm text-gray-600 dark:text-[#e5e5ea]">
            <Cpu size={15} class="text-pink-400 mt-0.5 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <span class="font-medium text-gray-700 dark:text-[#e5e5ea]">Thinking:</span>
              <div class="mt-1">
                <p class="text-[13px] leading-relaxed italic whitespace-pre-wrap text-gray-500 dark:text-gray-400">{reasoningContent}</p>
              </div>
            </div>
          </div>
        {/if}
        
        {#each traces as trace}
          <div class="flex items-center gap-3 text-[14px] text-slate-500 dark:text-[#e5e5ea]">
            {#if getIconForStep(trace) === 'search'}
              <Search size={15} class="text-blue-400 stroke-[1.5]" />
            {:else if getIconForStep(trace) === 'file'}
              <FileCode size={15} class="text-indigo-400 stroke-[1.5]" />
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
          <div class="flex items-center gap-3 text-[14px] text-slate-500 dark:text-[#e5e5ea]">
            <Activity size={15} class="text-gray-400 animate-pulse stroke-[1.5]" />
            <span class="animate-pulse font-medium working-dots">Working</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
