import { useEffect, useState } from 'react';
import { apiFetch } from './utils/api';
import { ShieldAlert, Check, X } from 'lucide-react';

export default function PendingTransactions() {
  const [pending, setPending] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await apiFetch('http://localhost:3000/api/transactions');
        if (res.ok) {
          setPending(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setLoadingId(id);
    try {
      const res = await apiFetch(`http://localhost:3000/api/transactions/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        setPending(prev => prev.filter(t => t.id !== id));
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Failed to ${action}: ${e.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, width: 350, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pending.map(tx => (
        <div key={tx.id} style={{ background: '#1e293b', padding: 20, borderRadius: 16, border: '1px solid #eab308', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <ShieldAlert color="#eab308" />
            <strong style={{ color: 'white' }}>Action Required</strong>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 15 }}>
            Type: {tx.type.toUpperCase()}<br/>
            Chain: {tx.chainName.toUpperCase()}<br/>
            {tx.type === 'transfer' ? `To: ${tx.details.toAddress}\nAmount: ${tx.details.amountEth}` : `Swap: ${tx.details.amount} ${tx.details.fromToken} to ${tx.details.toToken}`}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              onClick={() => handleAction(tx.id, 'approve')} 
              disabled={loadingId === tx.id}
              style={{ flex: 1, padding: '10px', background: loadingId === tx.id ? '#15803d' : '#22c55e', color: 'white', border: 'none', borderRadius: 8, cursor: loadingId === tx.id ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
              <Check size={16} /> {loadingId === tx.id ? 'Processing...' : 'Approve'}
            </button>
            <button 
              onClick={() => handleAction(tx.id, 'reject')} 
              disabled={loadingId === tx.id}
              style={{ flex: 1, padding: '10px', background: loadingId === tx.id ? '#b91c1c' : '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: loadingId === tx.id ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
              <X size={16} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
