import React from 'react';
import { ArrowRight, CheckCircle2, Copy } from 'lucide-react';

interface TransactionWidgetProps {
  data: string;
}

const TransactionWidget: React.FC<TransactionWidgetProps> = ({ data }) => {
  // Format example: "Successfully transferred 0.05 on base to 0x123..."
  let amount = '0.00';
  let chain = 'UNKNOWN';
  let address = '0x...';

  try {
    const amountMatch = data.match(/transferred ([\d.]+) on/i);
    if (amountMatch) amount = amountMatch[1];
    
    const chainMatch = data.match(/on (\w+) to/i);
    if (chainMatch) chain = chainMatch[1].toUpperCase();

    const addrMatch = data.match(/to (0x[a-fA-F0-9]+)/i);
    if (addrMatch) address = addrMatch[1];
  } catch (e) {
    // fallback
  }

  const truncateAddr = (addr: string) => addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);

  return (
    <div style={{
      background: '#0f172a',
      borderRadius: '24px',
      padding: '32px',
      border: '1px solid rgba(255,255,255,0.1)',
      width: '100%',
      maxWidth: '400px',
      margin: '0 auto',
      animation: 'fadeIn 0.5s ease-out forwards',
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ width: '64px', height: '64px', background: 'rgba(34,197,94,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle2 size={32} color="#4ade80" />
        </div>
        <h2 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Transaction Sent</h2>
        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Successfully confirmed on {chain}</span>
      </div>

      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Amount Sent</span>
          <span style={{ color: 'white', fontWeight: 600 }}>{amount} NATIVE</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '4px' }}>FROM</div>
            <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontFamily: 'monospace' }}>Agent Wallet</div>
          </div>
          <ArrowRight size={16} color="#64748b" />
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '4px' }}>TO</div>
            <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
              {truncateAddr(address)} <Copy size={12} color="#64748b" style={{cursor: 'pointer'}} />
            </div>
          </div>
        </div>
      </div>

      <button style={{
        width: '100%',
        padding: '14px',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'white',
        borderRadius: '12px',
        fontWeight: 600,
        cursor: 'pointer'
      }}>
        View on Explorer
      </button>
    </div>
  );
}

export default TransactionWidget;
