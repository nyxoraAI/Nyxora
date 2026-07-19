import { useEffect, useRef } from 'react';

export function usePolling(callback: () => void, intervalMs: number = 5000) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    // Initial fetch
    savedCallback.current();

    const tick = () => {
      // Only poll if tab is visible
      if (!document.hidden) {
        savedCallback.current();
      }
    };

    const id = setInterval(tick, intervalMs);
    
    // Immediately trigger on visibility change if it becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        savedCallback.current();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
}
