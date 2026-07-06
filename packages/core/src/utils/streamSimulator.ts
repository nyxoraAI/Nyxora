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
 * Creates a smart wrapper around an onChunk callback.
 * If the incoming chunk is large (e.g. Gemini buffering), it intercepts it and streams it smoothly.
 * If the chunk is small (e.g. OpenAI native stream), it passes it instantly.
 */
export const createSmartStreamWrapper = (originalOnChunk: (chunk: string) => void) => {
  let isSimulating = false;
  let queue = '';
  let resolveWait: (() => void) | null = null;
  let waitPromise = Promise.resolve();

  const processQueue = async () => {
    if (isSimulating || queue.length === 0) return;
    isSimulating = true;
    
    // Create a new wait promise if one doesn't exist
    if (!resolveWait) {
      waitPromise = new Promise(r => { resolveWait = r; });
    }
    
    if (queue.length > 0) {
      originalOnChunk(queue);
      queue = '';
    }
    
    isSimulating = false;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  let accumulatedRaw = '';
  let sentLength = 0;

  return {
    onChunk: (chunk: string) => {
      if (chunk === '[CLEAR_STREAM]') {
        accumulatedRaw = '';
        sentLength = 0;
        queue = '';
        originalOnChunk('[CLEAR_STREAM]');
        return;
      }
      accumulatedRaw += chunk;
      
      // Robust stripping: remove completely closed <think>...</think> blocks
      let cleanText = accumulatedRaw.replace(/<(think|thought|thinking|reasoning|analysis|reflection)[\s\S]*?<\/\1>\n?/gi, '');
      
      // Also, if there's currently an OPEN <think> block at the end of the text, strip it too (so we don't stream it while it's generating)
      cleanText = cleanText.replace(/<(think|thought|thinking|reasoning|analysis|reflection)[\s\S]*$/i, '');
      
      if (cleanText.length > sentLength) {
        const newText = cleanText.substring(sentLength);
        sentLength = cleanText.length;
        
        if (newText.length > 30) {
          queue += newText;
          processQueue();
        } else {
          if (isSimulating) {
            queue += newText;
          } else {
            originalOnChunk(newText);
          }
        }
      }
    },
    wait: async () => {
      await waitPromise;
    }
  };
};
