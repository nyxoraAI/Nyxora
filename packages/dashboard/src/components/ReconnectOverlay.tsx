import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function ReconnectOverlay() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('nyxora-network-error', handleOffline);
    window.addEventListener('nyxora-network-restored', handleOnline);

    return () => {
      window.removeEventListener('nyxora-network-error', handleOffline);
      window.removeEventListener('nyxora-network-restored', handleOnline);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOffline) {
      // Actively ping to see if it's back up
      interval = setInterval(async () => {
        try {
          // Just a light ping to the auth status endpoint
          await apiFetch('/api/auth/google/status');
        } catch (e) {
          // still offline
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontFamily: 'sans-serif'
    }}>
      <WifiOff size={64} color="#ef4444" style={{ marginBottom: '20px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
      <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>Nyxora Daemon Offline</h1>
      <p style={{ color: '#9ca3af', fontSize: '1.2rem' }}>Trying to reconnect...</p>
      
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
        `}
      </style>
    </div>
  );
}
