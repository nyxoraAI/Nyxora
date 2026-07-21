<script lang="ts">
  import AgentTrace from '../AgentTrace.svelte';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  let { msg } = $props();

  function renderMarkdown(text: string): string {
    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      .replace(/\[TOOL_CALL_DETECTED\][\s\S]*?(\[TOOL_CALL_FINISHED\]|$)/g, '')
      .trim();
    if (!cleaned) return '';
    return DOMPurify.sanitize(marked.parse(cleaned) as string);
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

<div class="flex flex-col w-full">
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
        <div class="markdown-body text-[15px] text-gray-900 dark:text-[#e5e9f0] mt-2 first:mt-0 {isLastStreaming ? 'message-streaming' : ''}">
          {@html html}
        </div>
      {/if}
    {/if}
  {/each}
</div>
