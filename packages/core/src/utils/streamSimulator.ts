export const simulateStream = async (text: string, onChunk: (chunk: string) => void, msPerChunk: number = 20, charsPerChunk: number = 3): Promise<void> => {
  return new Promise<void>((resolve) => {
    let index = 0;
    
    if (!text) {
      resolve();
      return;
    }

    const intervalId = setInterval(() => {
      if (index < text.length) {
        const chunk = text.substring(index, index + charsPerChunk);
        onChunk(chunk);
        index += charsPerChunk;
      } else {
        clearInterval(intervalId);
        resolve();
      }
    }, msPerChunk);
  });
};

/**
 * RC#2 FIX: Rewrote createSmartStreamWrapper with a reliable wait() mechanism.
 *
 * Old design problems:
 * - waitPromise started as Promise.resolve() — wait() was a no-op until processQueue ran
 * - resolveWait nulled after first call — subsequent chunks after resolution were untracked
 * - 30-char batching via queue complicated state and caused chunks to be dropped
 *
 * New design:
 * - inflightCount tracks how many chunk calls are in-flight
 * - wait() returns a Promise that only resolves when inflightCount reaches 0
 * - No batching queue — chunks pass through immediately (Telegram has its own 1.1s debounce)
 * - All think-tag stripping is preserved
 */
export const createSmartStreamWrapper = (originalOnChunk: (chunk: string) => void) => {
  let inflightCount = 0;
  const waiters: Array<() => void> = [];

  const checkWaiters = () => {
    if (inflightCount === 0 && waiters.length > 0) {
      waiters.splice(0).forEach(r => r());
    }
  };

  let accumulatedRaw = '';
  let sentLength = 0;

  return {
    onChunk: (chunk: string) => {
      if (chunk === '[CLEAR_STREAM]') {
        // Reset accumulator when a new turn begins (turn 1 only, due to RC#1 fix)
        accumulatedRaw = '';
        sentLength = 0;
        originalOnChunk('[CLEAR_STREAM]');
        return;
      }

      accumulatedRaw += chunk;

      // Strip fully-closed <think>...</think> blocks (reasoning traces should not stream)
      let cleanText = accumulatedRaw.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking|execute_tool|execute_bash|execute)[^>]*>[\s\S]*?<\/\1>/gi, '');

      // Strip an OPEN <think> block still being generated at the tail
      cleanText = cleanText.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking|execute_tool|execute_bash|execute)[^>]*>[\s\S]*$/i, '');

      // Strip fully-closed <tool_code>...</tool_code> blocks (LLM pseudo-code leakage)
      cleanText = cleanText.replace(/<tool_code>[\s\S]*?<\/tool_code>/gi, '');
      // Strip <tool_call>...</tool_call> blocks
      cleanText = cleanText.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');

      // Strip an OPEN <tool_code> or <tool_call> block still being streamed at the tail
      cleanText = cleanText.replace(/<tool_code>[\s\S]*$/i, '');
      cleanText = cleanText.replace(/<tool_call>[\s\S]*$/i, '');

      // Strip raw JSON tool arrays leaking as text: [{"tool_name": ... or [{"function_name": ...
      // We suppress from the opening bracket until the closing one is seen
      cleanText = cleanText.replace(/\[[\s\S]*?"tool_name"[\s\S]*?\]/g, '');
      cleanText = cleanText.replace(/\[[\s\S]*?"function_name"[\s\S]*?\]/g, '');
      // Suppress open bracket that looks like start of a tool array
      cleanText = cleanText.replace(/\[\s*\{[\s\S]*?"tool_(?:name|code)"[\s\S]*$/i, '');

      // Strip an incomplete opening tag (e.g. "<th", "<think") at the very end
      cleanText = cleanText.replace(/<[a-zA-Z-]*$/i, '');

      if (cleanText.length > sentLength) {
        const newText = cleanText.substring(sentLength);
        sentLength = cleanText.length;

        inflightCount++;
        try {
          originalOnChunk(newText);
        } finally {
          inflightCount--;
          checkWaiters();
        }
      }

    },

    wait: (): Promise<void> => {
      if (inflightCount === 0) return Promise.resolve();
      return new Promise<void>(resolve => waiters.push(resolve));
    }
  };
};
