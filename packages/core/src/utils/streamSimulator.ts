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
      let cleanText = accumulatedRaw.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*?<\/\1>/gi, '');

      // Strip an OPEN <think> block still being generated at the tail
      cleanText = cleanText.replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*$/i, '');

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
