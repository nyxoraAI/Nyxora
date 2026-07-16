import React from 'react';
import { LineChart, Search, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import './index.css';

const Market: React.FC = () => {
  return (
    <div className="overview-container">
      <div className="overview-header" style={{ marginBottom: '32px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LineChart color="var(--accent)" /> Market Dashboard
        </h1>
        <p>Real-time crypto prices, trending tokens, and market overview.</p>
      </div>

      <div className="dashboard-hero" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div className="hero-card pnl-card">
          <div className="hero-label">Today's PNL</div>
          <div className="hero-value positive">+$1,240.50</div>
          <div className="hero-subtext">Total Balance: $24,500.00</div>
        </div>
        <div className="hero-card">
          <div className="hero-label">Global Market Cap</div>
          <div className="hero-value">$2.4T</div>
          <div className="hero-subtext" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <ArrowUpRight size={14} /> +1.2% (24h)
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-label">24h Volume</div>
          <div className="hero-value">$84B</div>
          <div className="hero-subtext" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <ArrowDownRight size={14} /> -4.5% (24h)
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-label">BTC Dominance</div>
          <div className="hero-value">52.4%</div>
          <div className="hero-subtext" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <ArrowUpRight size={14} /> +0.2% (24h)
          </div>
        </div>
        <div className="hero-card status-card">
          <div className="hero-label">Agent Status</div>
          <div className="status-indicator">
            <div className="pulse-dot active"></div>
            <span className="status-text">Scanning Market</span>
          </div>
          <div className="hero-subtext">80 Active Skills</div>
        </div>
        <div className="hero-card limit-card">
          <div className="hero-label">API Usage</div>
          <div className="usage-bar-container">
            <div className="usage-bar" style={{ width: '45%' }}></div>
          </div>
          <div className="hero-subtext">45% of Daily Limit</div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)', padding: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Activity size={18} color="var(--accent)" /> Trending Tokens
        </h3>
        
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <LineChart size={48} opacity={0.5} style={{ marginBottom: '16px', color: 'var(--accent)' }} />
          <div>Market data will be populated here.</div>
          <div style={{ fontSize: '0.85rem', marginTop: '8px' }}>Fetching real-time data from aggregators...</div>
        </div>
      </div>
    </div>
  );
};

export default Market;
