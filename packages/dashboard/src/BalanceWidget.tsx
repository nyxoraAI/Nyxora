import React from 'react';
import { Wallet, CheckCircle2 } from 'lucide-react';

interface BalanceWidgetProps {
  data: string;
}

const BalanceWidget: React.FC<BalanceWidgetProps> = ({ data }) => {
  // Try to parse "0.05 on sepolia"
  let amount = '0.00';
  let chain = 'Unknown';
  
  if (data.includes(' on ')) {
    const parts = data.split(' on ');
    const rawAmount = parts[0];
    chain = parts[1].toUpperCase();
    
    // Parse the number to limit decimal places to max 6
    const parsedNum = parseFloat(rawAmount);
    if (!isNaN(parsedNum)) {
      amount = parsedNum.toLocaleString('en-US', { maximumFractionDigits: 6 });
    } else {
      amount = rawAmount;
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)',
      borderRadius: '24px',
      padding: '32px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
      width: '100%',
      maxWidth: '400px',
      margin: '0 auto',
      animation: 'fadeIn 0.5s ease-out forwards'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(59,130,246,0.2)', padding: '10px', borderRadius: '12px' }}>
            <Wallet size={24} color="#3b82f6" />
          </div>
          <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.9rem', letterSpacing: '1px' }}>WALLET BALANCE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.1)', padding: '6px 12px', borderRadius: '20px' }}>
          <CheckCircle2 size={14} color="#4ade80" />
          <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>LIVE</span>
        </div>
      </div>

      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', overflow: 'hidden' }}>
        <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', wordBreak: 'break-all' }}>{amount}</span>
        <span style={{ fontSize: '1.2rem', color: '#94a3b8', marginLeft: '8px', fontWeight: 500 }}>ETH</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Network</span>
        <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'monospace' }}>{chain}</span>
      </div>
    </div>
  );
};

export default BalanceWidget;
