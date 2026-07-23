<script lang="ts">
  import AgentTrace from '../AgentTrace.svelte';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { Copy, Check } from 'lucide-svelte';

  let { msg } = $props();
  let copied = $state(false);

  function copyText() {
    const rawText = segments.filter(s => s.type === 'text').map(s => s.content).join('');
    navigator.clipboard.writeText(rawText);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function renderMarkdown(text: string): string {
    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      .replace(/\[TOOL_CALL_DETECTED\][\s\S]*?(\[TOOL_CALL_FINISHED\]|$)/g, '')
      .trim();
    if (!cleaned) return '';
    return DOMPurify.sanitize(marked.parse(cleaned) as string);
  }

  function enhanceMarkdown(node: HTMLElement) {
    function apply() {
      const preBlocks = node.querySelectorAll('pre');
      preBlocks.forEach(pre => {
        if (pre.parentElement?.classList.contains('code-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper relative group my-4';
        pre.parentNode?.insertBefore(wrapper, pre);
        
        // Remove margin from pre since wrapper has it
        pre.style.margin = '0';
        wrapper.appendChild(pre);

        const btn = document.createElement('button');
        btn.className = 'copy-btn absolute top-2 right-2 px-2 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1.5 text-[11px] font-sans shadow-sm border border-gray-300 dark:border-gray-600';
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy`;
        
        btn.onclick = () => {
          const code = pre.querySelector('code')?.innerText || '';
          navigator.clipboard.writeText(code);
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
          setTimeout(() => {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy`;
          }, 2000);
        };
        
        wrapper.appendChild(btn);
      });
    }

    apply();
    return { update: apply };
  }

  let segments = $derived.by(() => {
    const raw = msg.content || '';
    const result: any[] = [];
    let currentIndex = 0;

    while (currentIndex < raw.length) {
      const nextThinkStart = raw.indexOf('<think>', currentIndex);
      const nextToolStart1 = raw.indexOf('[TOOL_CALL_DETECTED]', currentIndex);
      const nextToolStart2 = raw.indexOf('<tool_call>', currentIndex);

      let nextToolStart = -1;
      let toolStartStr = '';
      let toolEndStr = '';

      if (nextToolStart1 !== -1 && (nextToolStart2 === -1 || nextToolStart1 < nextToolStart2)) {
        nextToolStart = nextToolStart1;
        toolStartStr = '[TOOL_CALL_DETECTED]';
        toolEndStr = '[TOOL_CALL_FINISHED]';
      } else if (nextToolStart2 !== -1) {
        nextToolStart = nextToolStart2;
        toolStartStr = '<tool_call>';
        toolEndStr = '</tool_call>';
      }

      let nextTagStart = -1;
      let tagType = '';
      let activeEndStr = '';

      if (nextThinkStart !== -1 && (nextToolStart === -1 || nextThinkStart < nextToolStart)) {
        nextTagStart = nextThinkStart;
        tagType = 'think';
        activeEndStr = '</think>';
      } else if (nextToolStart !== -1) {
        nextTagStart = nextToolStart;
        tagType = 'tool';
        activeEndStr = toolEndStr;
      }

      if (nextTagStart === -1) {
        const remaining = raw.substring(currentIndex);
        if (remaining.trim()) result.push({ type: 'text', content: remaining });
        break;
      }

      if (nextTagStart > currentIndex) {
        const textBefore = raw.substring(currentIndex, nextTagStart);
        if (textBefore.trim()) result.push({ type: 'text', content: textBefore });
      }

      if (tagType === 'think') {
        const thinkEndIndex = raw.indexOf(activeEndStr, nextTagStart);
        if (thinkEndIndex !== -1) {
          const content = raw.substring(nextTagStart + '<think>'.length, thinkEndIndex);
          result.push({ type: 'think', content, closed: true });
          currentIndex = thinkEndIndex + activeEndStr.length;
        } else {
          const content = raw.substring(nextTagStart + '<think>'.length);
          result.push({ type: 'think', content, closed: false });
          break;
        }
      } else if (tagType === 'tool') {
        const toolEndIndex = raw.indexOf(activeEndStr, nextTagStart);
        if (toolEndIndex !== -1) {
          const content = raw.substring(nextTagStart + toolStartStr.length, toolEndIndex);
          result.push({ type: 'tool', content, closed: true });
          currentIndex = toolEndIndex + activeEndStr.length;
        } else {
          const content = raw.substring(nextTagStart + toolStartStr.length);
          result.push({ type: 'tool', content, closed: false });
          break;
        }
      }
    }

    return result;
  });

  let traceProps = $derived.by(() => {
    // Gabungkan data dari history (DB) dengan data hasil parse streaming agar sinkron
    const rawToolCalls = [...(msg.tool_calls || [])];
    let reasoningContent = msg.reasoning_content || '';
    const progressLogs = msg.progressLogs || [];
    
    for (const seg of segments) {
      if (seg.type === 'tool') {
        try {
          const parsed = JSON.parse(seg.content);
          rawToolCalls.push({ function: { name: parsed.tool_name || parsed.function_name || 'tool' }, arguments: seg.content });
        } catch {
          rawToolCalls.push({ function: { name: 'tool' }, arguments: seg.content });
        }
      } else if (seg.type === 'think') {
        reasoningContent += (reasoningContent ? '\n\n' : '') + seg.content;
      }
    }

    // Deduplicate tool calls based on stringified signature to prevent UI duplicates
    const seen = new Set();
    const toolCalls = rawToolCalls.filter(tc => {
      const sig = `${tc.function?.name}:${tc.function?.arguments || tc.arguments || ''}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });

    return { toolCalls, reasoningContent: reasoningContent.trim(), progressLogs };
  });

  let hasTrace = $derived(traceProps.toolCalls.length > 0 || traceProps.reasoningContent !== '' || traceProps.progressLogs.length > 0);
</script>

<div class="flex flex-col w-full group">
  {#if hasTrace}
    <AgentTrace 
      toolCalls={traceProps.toolCalls} 
      progressLogs={traceProps.progressLogs}
      reasoningContent={traceProps.reasoningContent}
      isStreaming={msg.isStreaming}
      durationMs={msg.duration_ms}
    />
  {/if}

  {#if segments.length === 0 && msg.isStreaming}
    <div class="working-indicator">
      <span class="working-dots">{msg.progress && msg.progress.includes('tool') ? 'Working' : 'Thinking'}</span>
    </div>
  {/if}

  {#each segments as segment, i}
    {#if segment.type === 'text'}
      {@const isLastStreaming = msg.isStreaming && i === segments.length - 1}
      {@const html = renderMarkdown(segment.content)}
      {#if html}
        <div use:enhanceMarkdown class="markdown-body text-gray-900 dark:text-[#f5f5f7] mt-2 first:mt-0 {isLastStreaming ? 'message-streaming' : ''}">
          {@html html}
        </div>
      {/if}
    {/if}
  {/each}
  
  {#if !msg.isStreaming && segments.some(s => s.type === 'text')}
    <div class="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onclick={copyText} class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#1d1d1f] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Copy Message">
        {#if copied}
          <Check size={14} class="text-green-500" />
        {:else}
          <Copy size={14} />
        {/if}
      </button>
    </div>
  {/if}
</div>
