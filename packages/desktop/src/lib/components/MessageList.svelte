<script lang="ts">
  import { chatStore } from '$lib/stores/chat';
  import StructuredMessage from './chat/StructuredMessage.svelte';
  import AgentTrace from './AgentTrace.svelte';

  let messages = $derived($chatStore.messages);
  let container: HTMLDivElement;

  $effect(() => {
    // This runs whenever dependencies inside it (like messages length) change
    if (messages.length && container) {
      container.scrollTop = container.scrollHeight;
    }
  });

  // Merge messages with tool_calls and reasoning
  const mergedMessages = $derived(() => {
    const merged: any[] = [];
    let currentAssistantMsg: any = null;
    
    for (const m of messages) {
      if (m.role === 'user') {
        if (currentAssistantMsg) {
          merged.push(currentAssistantMsg);
          currentAssistantMsg = null;
        }
        merged.push(m);
      } else if (m.role === 'assistant') {
        if (currentAssistantMsg) {
          // Merge tool_calls
          if (m.tool_calls) {
            currentAssistantMsg.tool_calls = [...(currentAssistantMsg.tool_calls || []), ...m.tool_calls];
          }
          // Merge reasoning
          if (m.reasoning_content) {
            currentAssistantMsg.reasoning_content = (currentAssistantMsg.reasoning_content || '') + m.reasoning_content;
          }
          // Update content
          if (m.content && m.content.trim() !== '') {
            if (currentAssistantMsg.tool_calls && currentAssistantMsg.tool_calls.length > 0) {
              currentAssistantMsg.content = m.content.trim();
            } else {
              currentAssistantMsg.content = (currentAssistantMsg.content || '') + m.content;
            }
          }
          currentAssistantMsg.isStreaming = m.isStreaming;
        } else {
          currentAssistantMsg = { ...m };
        }
      } else if (m.role === 'tool') {
        // Do not push into tool_calls again, as the assistant message already contains the tool_calls definition.
        // This prevents duplicate 'Ran tool' traces.
      }
    }
    
    if (currentAssistantMsg) {
      merged.push(currentAssistantMsg);
    }
    
    return merged;
  });
</script>

<div bind:this={container} class="{messages.length > 0 ? 'flex-1 p-4 md:p-8' : 'h-0'} overflow-y-auto flex flex-col gap-6 items-center">
  {#if mergedMessages().length > 0}
    <div class="w-full max-w-3xl mx-auto flex flex-col gap-6">
      {#each mergedMessages() as msg}
        <div class="flex flex-col gap-2 w-full {msg.role === 'user' ? 'items-end' : 'items-start'} message-fade-in">
          <div class="max-w-[80%] {msg.role === 'user' ? 'bg-gray-100 dark:bg-[#3b4252] rounded-[1.25rem] px-5 py-3' : 'pt-1 w-full'}">
            {#if msg.role === 'user'}
              <div class="prose dark:prose-invert max-w-none text-[15px] whitespace-pre-wrap text-gray-900 dark:text-[#e5e9f0]">
                {msg.content}
              </div>
            {:else}
              <StructuredMessage {msg} />
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
