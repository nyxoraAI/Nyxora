import React from 'react';
import { ArrowDownUp, CheckCircle2, RefreshCcw } from 'lucide-react';

interface SwapWidgetProps {
  data: string;
}

const SwapWidget: React.FC<SwapWidgetProps> = ({ data }) => {
  if (data.startsWith('TRANSACTION_PENDING')) {
    return null;
  }

  let parsedData = null;
  try {
    parsedData = JSON.parse(data);
  } catch (e) {
    return (
      <div className="widget-card error">
        <h3 className="widget-title">Swap Error</h3>
        <p>Failed to parse swap data.</p>
      </div>
    );
  }

  if (parsedData.error) {
    return (
      <div className="widget-card error">
        <h3 className="widget-title">Transaction Failed</h3>
        <p>{parsedData.error}</p>
      </div>
    );
  }

  return (
    <div className="widget-card swap-widget" style={{ 
      background: 'rgba(30, 41, 59, 0.7)', 
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      padding: '28px',
      color: 'var(--text-primary)',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      width: '100%',
      maxWidth: '420px',
      margin: '0 auto',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCcw size={18} color="#a855f7" />
          DeFi Swap Execution
        </h3>
        <span style={{ 
          background: 'rgba(34, 197, 94, 0.2)', 
          color: '#4ade80', 
          padding: '4px 10px', 
          borderRadius: '12px', 
          fontSize: '0.75rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <CheckCircle2 size={14} /> {parsedData.status}
        </span>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '16px', padding: '20px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Pay</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{parsedData.fromAmount}</span>
          <span style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '12px', fontWeight: 600 }}>
            {parsedData.fromToken}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-20px 0', position: 'relative', zIndex: 10 }}>
        <div style={{ 
          background: '#1e293b', 
          border: '1px solid rgba(255,255,255,0.1)', 
          padding: '8px', 
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          <ArrowDownUp size={20} color="#a855f7" />
        </div>
      </div>

      <div style={{ background: 'rgba(168, 85, 247, 0.1)', borderRadius: '16px', padding: '20px', marginBottom: '24px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
        <div style={{ fontSize: '0.8rem', color: '#c084fc', marginBottom: '8px' }}>Receive</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e9d5ff' }}>{parsedData.toAmount}</span>
          <span style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#e9d5ff', padding: '6px 12px', borderRadius: '12px', fontWeight: 600 }}>
            {parsedData.toToken}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Exchange Rate</span>
          <span style={{ color: 'var(--text-primary)' }}>1 {parsedData.fromToken} = {parsedData.exchangeRate} {parsedData.toToken}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Network</span>
          <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{parsedData.chain}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Network Fee (Gas)</span>
          <span style={{ color: '#f59e0b' }}>{parsedData.gasFee}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
          <span>Transaction Hash</span>
          <a 
            href={`#`}
            style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {parsedData?.txHash?.substring(0, 8)}...{parsedData?.txHash?.substring(60)}
          </a>
        </div>
      </div>
      
      <div style={{ marginTop: '24px', width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #3b82f6, #a855f7)', animation: 'progress 2s ease-in-out' }}></div>
      </div>
    </div>
  );
};

export default SwapWidget;
