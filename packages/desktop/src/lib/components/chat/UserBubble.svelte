<script lang="ts">
  import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-svelte';

  let { 
    content = '', 
    index, 
    copiedMessageIndex, 
    onCopy 
  } = $props<{ 
    content: string; 
    index: number; 
    copiedMessageIndex: number | null; 
    onCopy: (content: string, index: number) => void;
  }>();

  let expanded = $state(false);

  const MAX_LENGTH = 300;
  const lines = $derived(content.split('\n'));
  const isLong = $derived(content.length > MAX_LENGTH || lines.length > 4);
</script>

<div class="relative group/bubble">
  <div 
    class="relative bg-gray-100 dark:bg-[#2c2c2e] rounded-[1.25rem] px-4 transition-all duration-300 ease-in-out overflow-hidden"
    style="
      max-height: {(!expanded && isLong) ? '100px' : (expanded ? '2000px' : 'none')};
      padding-top: 10px;
      padding-bottom: {isLong ? '36px' : '10px'};
    "
  >
    <div class="prose dark:prose-invert max-w-none text-[15px] whitespace-pre-wrap text-gray-900 dark:text-[#f5f5f7]">
      {content}
    </div>

    {#if isLong && !expanded}
      <!-- Gradient fade out for truncated text -->
      <div class="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-gray-100 dark:from-[#2c2c2e] to-transparent pointer-events-none transition-opacity duration-300"></div>
    {/if}

    {#if isLong}
      <button
        onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}
        class="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-transparent flex items-center justify-center cursor-pointer text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-all border-none z-10"
        title={expanded ? "Show Less" : "Show More"}
      >
        {#if expanded}
          <ChevronUp size={18} strokeWidth={2.5} />
        {:else}
          <ChevronDown size={18} strokeWidth={2.5} />
        {/if}
      </button>
    {/if}
  </div>

  <button 
    onclick={() => onCopy(content, index)} 
    class="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[#2c2c2e] dark:hover:bg-[#3a3a3c] text-gray-500 dark:text-gray-400 cursor-pointer shadow-sm border border-transparent dark:border-gray-600"
    title="Copy Message"
  >
    {#if copiedMessageIndex === index}
      <Check size={14} class="text-green-500" />
    {:else}
      <Copy size={14} />
    {/if}
  </button>
</div>
