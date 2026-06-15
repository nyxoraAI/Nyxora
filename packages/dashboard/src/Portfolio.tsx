import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from './utils/api';
import { Wallet, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react';
import { formatUnits } from 'viem';
import { getChainLogoUrl, getTokenLogoUrl } from './utils/logos';
import { NetworkSelector } from './NetworkSelector';

interface TokenBalance {
  symbol: string;
  address: string;
  balanceRaw: string;
  decimals: number;
  isNative: boolean;
  priceUsd?: number;
  priceChange24h?: number;
}

interface PortfolioData {
  [chainName: string]: TokenBalance[];
}

export const Portfolio: React.FC = () => {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError('');
    try {
      const [resPortfolio, resWallet] = await Promise.all([
        apiFetch('/api/portfolio'),
        apiFetch('/api/wallet')
      ]);
      
      if (resPortfolio.ok) {
        setData(await resPortfolio.json());
      } else {
        setError('Failed to fetch portfolio data from gateway.');
      }

      if (resWallet.ok) {
        const wJson = await resWallet.json();
        setWalletAddress(wJson.address);
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
    };
    return map[chain.toLowerCase()] || '#88C0D0';
  };

  const getParsedBalance = (raw: string, decimals: number) => {
    if (decimals === -1) decimals = 18;
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

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const flatTokens = useMemo(() => {
    if (!data) return [];
    let tokens: (TokenBalance & { chain: string })[] = [];
    Object.entries(data).forEach(([chain, chainTokens]) => {
      chainTokens.forEach(t => {
        tokens.push({ ...t, chain });
      });
    });

    if (selectedChain !== 'all') {
      tokens = tokens.filter(t => t.chain.toLowerCase() === selectedChain.toLowerCase());
    }

    tokens.sort((a, b) => {
      const valA = (a.priceUsd || 0) * getParsedBalance(a.balanceRaw, a.decimals);
      const valB = (b.priceUsd || 0) * getParsedBalance(b.balanceRaw, b.decimals);
      return valB - valA;
    });

    return tokens;
  }, [data, selectedChain]);

  const { totalUsd, totalChange } = useMemo(() => {
    let sum = 0;
    let changeSum = 0;
    flatTokens.forEach(t => {
      const val = (t.priceUsd || 0) * getParsedBalance(t.balanceRaw, t.decimals);
      sum += val;
      changeSum += val * (t.priceChange24h || 0);
    });
    return { 
      totalUsd: sum, 
      totalChange: sum > 0 ? changeSum / sum : 0 
    };
  }, [flatTokens]);

  return (
    <div className="overview-container" style={{ paddingBottom: '40px' }}>
      <div className="overview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Wallet color="#88C0D0" /> Portfolio Scanner
          </h1>
          
          {walletAddress && (
            <div 
              onClick={copyAddress}
              style={{ 
                color: '#D8DEE9', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: 'rgba(76, 86, 106, 0.5)',
                padding: '4px 12px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(76, 86, 106, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(76, 86, 106, 0.1)'}
            >
              {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
              {copied ? <Check size={14} color="#A3BE8C" /> : <Copy size={14} />}
            </div>
          )}

          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ECEFF4', marginTop: '24px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            $ {totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: '1rem', color: totalChange >= 0 ? '#A3BE8C' : '#BF616A', fontWeight: '500' }}>
              {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <NetworkSelector 
            value={selectedChain}
            onChange={(val) => setSelectedChain(val)}
            showAllOption={true}
          />

          <button 
            onClick={fetchPortfolio} 
            disabled={loading}
            style={{
              background: '#88C0D0',
              color: '#2E3440',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#8FBCBB')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#88C0D0')}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
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

      {data && flatTokens.length > 0 && (
        <div style={{ 
          background: '#2E3440', 
          borderRadius: '12px', 
          border: '1px solid #3B4252', 
          overflow: 'hidden',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 1fr 1fr 1fr', 
            gap: '16px', 
            padding: '16px 24px', 
            background: '#3B4252', 
            borderBottom: '1px solid #4C566A', 
            color: '#D8DEE9', 
            fontWeight: '600', 
            fontSize: '0.85rem',
            letterSpacing: '1px'
          }}>
            <div>TOKEN</div>
            <div style={{ textAlign: 'right' }}>PRICE</div>
            <div style={{ textAlign: 'right' }}>AMOUNT</div>
            <div style={{ textAlign: 'right' }}>USD VALUE</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {flatTokens.map((t, idx) => {
              const usdVal = (t.priceUsd || 0) * getParsedBalance(t.balanceRaw, t.decimals);
              return (
                <div key={`${t.chain}-${t.address}-${idx}`} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1fr 1fr', 
                  gap: '16px',
                  padding: '16px 24px',
                  borderBottom: idx === flatTokens.length - 1 ? 'none' : '1px solid #3B4252',
                  alignItems: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 66, 82, 0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                      <div style={{ 
                        width: '100%', height: '100%', 
                        borderRadius: '50%', 
                        background: t.isNative ? 'rgba(136, 192, 208, 0.1)' : 'rgba(163, 190, 140, 0.1)',
                        color: t.isNative ? '#88C0D0' : '#A3BE8C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '0.9rem', overflow: 'hidden'
                      }}>
                        <span style={{ position: 'absolute', zIndex: 1 }}>{t.symbol.substring(0, 3)}</span>
                        <img 
                          src={getTokenLogoUrl(t.chain, t.address, t.isNative)} 
                          alt={t.symbol} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 2, background: '#2E3440' }} 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      
                      {/* Chain Badge (Rabby Style) */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#2E3440',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 3,
                        padding: '2px'
                      }}>
                        <div style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          background: getChainColor(t.chain),
                          overflow: 'hidden'
                        }}>
                          <img 
                            src={getChainLogoUrl(t.chain)} 
                            alt={t.chain} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      </div>
                    </div>
                    <span style={{ color: '#ECEFF4', fontWeight: '600', fontSize: '1.1rem' }}>{t.symbol}</span>
                  </div>
                  
                  <div style={{ textAlign: 'right', color: '#D8DEE9', fontWeight: '500' }}>
                    {t.priceUsd ? `$${t.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '-'}
                  </div>
                  
                  <div style={{ textAlign: 'right', color: '#ECEFF4', fontWeight: '600' }}>
                    {formatBalance(t.balanceRaw, t.decimals)} <span style={{ fontSize: '0.85rem', color: '#81A1C1', fontWeight: 'normal' }}>{t.symbol}</span>
                  </div>
                  
                  <div style={{ textAlign: 'right', color: '#A3BE8C', fontWeight: '600', fontSize: '1.1rem' }}>
                    {usdVal > 0 ? `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data && flatTokens.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#4C566A', border: '1px dashed #4C566A', borderRadius: '12px' }}>
          No assets found in this wallet for the selected network.
        </div>
      )}
    </div>
  );
};
