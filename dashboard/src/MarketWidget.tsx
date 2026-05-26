import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MarketWidgetProps {
  data: string;
}

const MarketWidget: React.FC<MarketWidgetProps> = ({ data }) => {
  let parsedData = null;
  try {
    parsedData = JSON.parse(data);
  } catch (e) {
    return null;
  }

  if (parsedData.error) {
    return (
      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '16px' }}>
        <p style={{ color: '#ef4444' }}>{parsedData.error}</p>
      </div>
    );
  }

  const { coin, priceUsd, change24h } = parsedData;
  const isPositive = change24h >= 0;
  const color = isPositive ? '#4ade80' : '#ef4444';
  const bgColor = isPositive ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div style={{ 
      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <Activity size={24} color="#3b82f6" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white', textTransform: 'capitalize' }}>{coin}</h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Live Price (USD)</span>
          </div>
        </div>
        <div style={{ 
          background: bgColor, 
          color: color, 
          padding: '6px 12px', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          <Icon size={16} />
          {isPositive ? '+' : ''}{change24h.toFixed(2)}%
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', overflow: 'hidden' }}>
        <span style={{ fontSize: '3rem', fontWeight: 800, color: 'white', letterSpacing: '-1px', wordBreak: 'break-all' }}>
          ${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
        </span>
      </div>
    </div>
  );
};

export default MarketWidget;
