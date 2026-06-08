import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api';
import { Wallet, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatUnits } from 'viem';
import { getChainLogoUrl, getTokenLogoUrl } from './utils/logos';

interface TokenBalance {
  symbol: string;
  address: string;
  balanceRaw: string;
  decimals: number;
  isNative: boolean;
  priceUsd?: number;
}

interface PortfolioData {
  [chainName: string]: TokenBalance[];
}

export const Portfolio: React.FC = () => {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPortfolio = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/portfolio');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError('Failed to fetch portfolio data from gateway.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const getChainColor = (chain: string) => {
    const map: any = {
      ethereum: '#627EEA',
      base: '#0052FF',
      arbitrum: '#28A0F0',
      optimism: '#FF0420',
      bsc: '#F0B90B',
      polygon: '#8247E5',
      sepolia: '#CFB53B',
      arbitrum_sepolia: '#28A0F0',
      optimism_sepolia: '#FF0420'
    };
    return map[chain.toLowerCase()] || '#88C0D0';
  };

  const getParsedBalance = (raw: string, decimals: number) => {
    if (decimals === -1) decimals = 18; // Default ERC20 fallback if backend didn't fetch it
    try {
      return parseFloat(formatUnits(BigInt(raw), decimals));
    } catch {
      return 0;
    }
  };

  const formatBalance = (raw: string, decimals: number) => {
    const num = getParsedBalance(raw, decimals);
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <div className="overview-container" style={{ paddingBottom: '40px' }}>
      <div className="overview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet color="#88C0D0" /> Portfolio Scanner
          </h1>
          <p>Real-time view of your Web3 assets across all supported networks.</p>
        </div>
        <button 
          onClick={fetchPortfolio} 
          disabled={loading}
          style={{
            background: '#3B4252',
            color: '#D8DEE9',
            border: '1px solid #4C566A',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#434C5E')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#3B4252')}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(191, 97, 106, 0.1)', border: '1px solid #BF616A', padding: '16px', borderRadius: '8px', color: '#BF616A', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {!data && loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#88C0D0' }}>
          <div className="dot" style={{ background: '#88C0D0', animation: 'pulse 1s infinite', display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', marginRight: '8px' }}></div>
          Scanning blockchains...
        </div>
      )}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {Object.entries(data).map(([chain, tokens]) => {
            if (tokens.length === 0) return null; // Hide empty chains
            return (
              <div key={chain} style={{
                background: '#2E3440',
                border: '1px solid #3B4252',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  padding: '16px',
                  background: '#3B4252',
                  borderBottom: '1px solid #4C566A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: '600',
                  color: '#ECEFF4',
                  textTransform: 'capitalize'
                }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: getChainColor(chain), display: 'flex', overflow: 'hidden' }}>
                    <img 
                      src={getChainLogoUrl(chain)} 
                      alt={chain} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  {chain.replace('_', ' ')}
                </div>
                
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tokens.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: '32px', height: '32px', 
                          borderRadius: '8px', 
                          background: t.isNative ? 'rgba(136, 192, 208, 0.1)' : 'rgba(163, 190, 140, 0.1)',
                          color: t.isNative ? '#88C0D0' : '#A3BE8C',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '0.8rem', position: 'relative', overflow: 'hidden'
                        }}>
                          <span style={{ position: 'absolute', zIndex: 1 }}>{t.symbol.substring(0, 3)}</span>
                          <img 
                            src={getTokenLogoUrl(chain, t.address, t.isNative)} 
                            alt={t.symbol} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 2, background: '#2E3440' }} 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                        <span style={{ color: '#D8DEE9', fontWeight: '500' }}>{t.symbol}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#ECEFF4', fontWeight: '600' }}>{formatBalance(t.balanceRaw, t.decimals)}</div>
                        {!!t.priceUsd && (
                          <div style={{ color: '#A3BE8C', fontSize: '0.85rem', marginTop: '4px', fontWeight: '500' }}>
                            $ {(getParsedBalance(t.balanceRaw, t.decimals) * t.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data && Object.values(data).every(tokens => tokens.length === 0) && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#4C566A', border: '1px dashed #4C566A', borderRadius: '12px' }}>
          No assets found in this wallet across supported networks.
        </div>
      )}
    </div>
  );
};
