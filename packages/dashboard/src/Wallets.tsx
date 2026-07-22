import React, { useState, useEffect } from 'react';
import { Wallet, Key, Plus, Copy, ExternalLink, RefreshCw, Eye, EyeOff, ShieldAlert, Loader2 } from 'lucide-react';
import { apiFetch } from './utils/api';
import { getChainLogoUrl } from './utils/logos';

export const Wallets: React.FC = () => {
  const [mainWallet, setMainWallet] = useState<string>('');
  const [balances, setBalances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchWalletData = async () => {
    setIsLoading(true);
    try {
      const [walletRes, portfolioRes] = await Promise.all([
        apiFetch('/api/wallet').catch(() => null),
        apiFetch('/api/portfolio').catch(() => null)
      ]);
      
      if (walletRes && walletRes.ok) {
        const walletData = await walletRes.json();
        if (walletData.address) setMainWallet(walletData.address);
      }
      
      if (portfolioRes && portfolioRes.ok) {
        const portData = await portfolioRes.json();
        const flattened = [];
        for (const [chainName, assets] of Object.entries(portData)) {
          if (Array.isArray(assets)) {
            for (const a of assets) {
              flattened.push({
                asset: a.symbol || 'Unknown',
                amount: a.balance || '0',
                chain: chainName,
                value: a.usdValue ? `$${a.usdValue.toFixed(2)}` : '$-',
                icon: a.logoURI || getChainLogoUrl(chainName)
              });
            }
          }
        }
        setBalances(flattened);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  return (
    <div className="overview-container" style={{ padding: '24px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px' }}>
            <Wallet size={24} color="#10b981" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Wallets & Assets</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Agent's operational hot wallet and portfolio.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Main Wallet Card */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 70%)', transform: 'translate(30%, -30%)' }} />
          
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '16px' }}>MAIN WALLET (EVM)</div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '50%' }}>
                <Key size={24} color="var(--accent)" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '1.5rem', fontFamily: 'monospace' }}>
                  {mainWallet ? `${mainWallet.substring(0, 6)}...${mainWallet.substring(38)}` : 'Not configured'}
                </h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => { if(mainWallet) navigator.clipboard.writeText(mainWallet); }} style={{ background: 'none', border: 'none', padding: 0, color: '#10b981', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Copy size={12}/> Copy Address</button>
                  {mainWallet && <a href={`https://basescan.org/address/${mainWallet}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#3b82f6', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><ExternalLink size={12}/> Explorer</a>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Table */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>ASSETS & BALANCES</div>
            <button style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}><RefreshCw size={14}/> Refresh</button>
          </div>
          
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Asset</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Chain</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textAlign: 'right' }}>Value (USD)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}><Loader2 size={24} className="spin" style={{ margin: '0 auto' }} /></td></tr>
                ) : balances.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No assets in this wallet.</td></tr>
                ) : balances.map((b, i) => (
                  <tr key={i} style={{ borderBottom: i === balances.length - 1 ? 'none' : '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={b.icon} alt={b.asset} style={{ width: 24, height: 24, borderRadius: '50%' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <strong style={{ color: 'var(--text-primary)' }}>{b.asset}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{b.chain}</td>
                    <td style={{ padding: '16px', color: 'var(--text-primary)', fontSize: '0.9rem', textAlign: 'right', fontWeight: 600 }}>{b.amount}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'right' }}>{b.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Wallets;
