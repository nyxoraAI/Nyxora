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
    
    while (queue.length > 0) {
      const chars = queue.substring(0, 3);
      queue = queue.substring(3);
      originalOnChunk(chars);
      await new Promise(r => setTimeout(r, 20));
    }
    
    isSimulating = false;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  return {
    onChunk: (chunk: string) => {
      if (chunk.length > 30) {
        queue += chunk;
        processQueue();
      } else {
        if (isSimulating) {
          queue += chunk;
        } else {
          originalOnChunk(chunk);
        }
      }
    },
    wait: async () => {
      await waitPromise;
    }
  };
};
