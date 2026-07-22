<script lang="ts">
  import { chatStore } from '$lib/stores/chat';
  import StructuredMessage from './chat/StructuredMessage.svelte';
  import AgentTrace from './AgentTrace.svelte';

  import { tick } from 'svelte';
  import { ArrowDown } from 'lucide-svelte';

  let messages = $derived($chatStore.messages);
  let container: HTMLDivElement;
  
  let isUserScrolledUp = $state(false);
  let previousMergedCount = $state(0);
  let lastSnappedUserIndex = $state(-1);
  let isAutoScrolling = false;
  let spacerHeight = $state(0);

  function updateSpacer() {
     if (!container) return;
     const allMsgs = container.querySelectorAll('.message-fade-in');
     if (allMsgs.length === 0) {
         spacerHeight = 0;
         return;
     }
     const lastMsgEl = allMsgs[allMsgs.length - 1] as HTMLElement;
     
     let lastUserEl = null;
     for(let i = allMsgs.length - 1; i >= 0; i--) {
        if (allMsgs[i].classList.contains('items-end')) {
            lastUserEl = allMsgs[i] as HTMLElement;
            break;
        }
     }
     
     if (lastUserEl) {
         const contentBelowTop = (lastMsgEl.offsetTop + lastMsgEl.offsetHeight) - lastUserEl.offsetTop;
         const desiredMinHeight = container.clientHeight - 80;
         
         if (contentBelowTop < desiredMinHeight) {
             spacerHeight = desiredMinHeight - contentBelowTop;
         } else {
             spacerHeight = 0;
         }
     }
  }

  function handleScroll() {
    if (!container || isAutoScrolling) return;
    const threshold = 100;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    isUserScrolledUp = !isAtBottom;
  }

  function scrollToBottom() {
    if (container) {
      isAutoScrolling = true;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      isUserScrolledUp = false;
      setTimeout(() => { isAutoScrolling = false; }, 500);
    }
  }

  $effect(() => {
    const merged = mergedMessages();
    const currentMergedCount = merged.length;
    const hasStreaming = merged.some(m => m.isStreaming);

    tick().then(() => {
       updateSpacer();
       
       if (currentMergedCount > previousMergedCount && container) {
           let lastUserIndex = -1;
           for (let i = merged.length - 1; i >= 0; i--) {
             if (merged[i].role === 'user') {
               lastUserIndex = i;
               break;
             }
           }
           
           if (lastUserIndex !== -1 && lastUserIndex > lastSnappedUserIndex) {
              const el = document.getElementById(`msg-${lastUserIndex}`);
              if (el) {
                 isAutoScrolling = true;
                 setTimeout(() => {
                   el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                   isUserScrolledUp = false;
                   setTimeout(() => { isAutoScrolling = false; }, 800);
                 }, 50);
                 lastSnappedUserIndex = lastUserIndex;
              }
           } else {
              if (!isUserScrolledUp) container.scrollTop = container.scrollHeight;
           }
       } else if (hasStreaming && !isUserScrolledUp && !isAutoScrolling && container) {
           // Karena spacerHeight sudah menghilangkan "ruang hampa", 
           // kita bisa dengan aman menarik scroll langsung ke dasar kontainer (scrollHeight)
           // Ini akan secara otomatis meluncur pelan seirama dengan teks yang bertambah panjang.
           const maxScroll = container.scrollHeight - container.clientHeight;
           if (container.scrollTop < maxScroll) {
               container.scrollTop = maxScroll;
           }
       }
       
       previousMergedCount = currentMergedCount;
    });
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

<div onscroll={handleScroll} bind:this={container} class="{messages.length > 0 ? 'flex-1 p-4 md:p-8' : 'h-0'} overflow-y-auto flex flex-col gap-6 items-center relative">
  {#if mergedMessages().length > 0}
    <div class="w-full max-w-3xl mx-auto flex flex-col gap-6 relative">
      {#each mergedMessages() as msg, i}
        <div id={`msg-${i}`} class="flex flex-col gap-2 w-full {msg.role === 'user' ? 'items-end' : 'items-start'} message-fade-in">
          <div class="{msg.role === 'user' ? 'max-w-[80%] bg-gray-100 dark:bg-[#3b4252] rounded-[1.25rem] px-5 py-3' : 'max-w-full pt-1 w-full'}">
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
      
      <!-- Dynamic Spacer to ensure snap-to-top doesn't create permanent empty canvas -->
      <div style="height: {spacerHeight}px; flex-shrink: 0;"></div>
    </div>
  {/if}
  
  <!-- Scroll to Bottom Button -->
  {#if isUserScrolledUp && mergedMessages().length > 0}
    <button 
      onclick={scrollToBottom}
      class="fixed bottom-28 md:bottom-32 right-8 md:right-1/4 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-all z-50 hover:bg-gray-50 dark:hover:bg-gray-700"
      title="Scroll to bottom"
    >
      <ArrowDown size={18} />
    </button>
  {/if}
</div>
