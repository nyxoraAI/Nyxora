import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from './utils/api';
import { Wallet, RefreshCw, AlertTriangle, Copy, Check, Plus, X, Trash2 } from 'lucide-react';
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

interface WhitelistedToken {
  chainName: string;
  address: string;
  symbol?: string;
  decimals?: number;
  source: string;
}

export const Portfolio: React.FC<{ baseFiat?: string }> = ({ baseFiat = 'usd' }) => {
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  useEffect(() => {
    if (baseFiat.toLowerCase() === 'usd') {
      setExchangeRate(1);
      return;
    }
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${baseFiat.toLowerCase()}`)
      .then(res => res.json())
      .then(data => {
        const rate = data.tether?.[baseFiat.toLowerCase()];
        if (rate) setExchangeRate(rate);
      })
      .catch(err => console.error('Failed to fetch exchange rate', err));
  }, [baseFiat]);

  const fiatSymbol = useMemo(() => {
    const f = baseFiat.toLowerCase();
    if (f === 'idr') return 'Rp ';
    if (f === 'eur') return '€';
    if (f === 'jpy') return '¥';
    if (f === 'gbp') return '£';
    if (f === 'aud') return 'A$';
    if (f === 'krw') return '₩';
    if (f === 'inr') return '₹';
    if (f === 'cny') return '¥';
    return '$';
  }, [baseFiat]);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Whitelist State
  const [whitelist, setWhitelist] = useState<WhitelistedToken[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [customCa, setCustomCa] = useState('');
  const [customChain, setCustomChain] = useState('ethereum');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customDecimals, setCustomDecimals] = useState('');
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError('');
    try {
      const [resPortfolio, resWallet, resWhitelist] = await Promise.all([
        apiFetch('/api/portfolio'),
        apiFetch('/api/wallet'),
        apiFetch('/api/portfolio/whitelist')
      ]);
      
      if (resPortfolio.ok) {
        setData(await resPortfolio.json());
      } else {
        setError('Failed to fetch portfolio data from gateway.');
      }

      let addr = '';
      if (resWallet.ok) {
        const wJson = await resWallet.json();
        addr = wJson.address;
        setWalletAddress(addr);
      }

      if (resWhitelist.ok && addr) {
        const wlData = await resWhitelist.json();
        if (wlData[addr.toLowerCase()]) {
          setWhitelist(wlData[addr.toLowerCase()]);
        }
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

  const handleCaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomCa(val);
    setCustomSymbol('');
    setCustomDecimals('');

    if (val.startsWith('0x') && val.length === 42) {
      setFetchingMetadata(true);
      try {
        const res = await apiFetch(`/api/portfolio/token-metadata?chain=${customChain}&address=${val}`);
        if (res.ok) {
          const meta = await res.json();
          setCustomSymbol(meta.symbol);
          setCustomDecimals(meta.decimals.toString());
        }
      } catch (err) {
        console.error('Failed to fetch metadata', err);
      } finally {
        setFetchingMetadata(false);
      }
    }
  };

  const handleAddCustomToken = async () => {
    if (!customCa || !customSymbol) return;
    setAddingCustom(true);
    try {
      await apiFetch('/api/portfolio/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          chainName: customChain,
          tokenAddress: customCa,
          symbol: customSymbol,
          decimals: parseInt(customDecimals) || 18
        })
      });
      setShowModal(false);
      setCustomCa('');
      setCustomSymbol('');
      setCustomDecimals('');
      fetchPortfolio(); // Refresh lists
    } catch (err) {
      console.error(err);
    } finally {
      setAddingCustom(false);
    }
  };

  const handleRemoveToken = async (chainName: string, tokenAddress: string) => {
    try {
      await apiFetch('/api/portfolio/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, chainName, tokenAddress })
      });
      fetchPortfolio();
    } catch (err) {
      console.error(err);
    }
  };

  const getChainColor = (chain: string) => {
    const map: any = {
      ethereum: '#627EEA',
      base: '#0052FF',
      arbitrum: '#28A0F0',
      optimism: '#FF0420',
      bsc: '#F0B90B',
      polygon: '#8247E5',
    };
    return map[chain.toLowerCase()] || 'var(--accent)';
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
            <Wallet color="var(--accent)" /> Portfolio Scanner
          </h1>
          
          {walletAddress && (
            <div 
              onClick={copyAddress}
              style={{ 
                color: 'var(--text-primary)', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                padding: '4px 12px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--tool-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            >
              {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
              {copied ? <Check size={14} color="#A3BE8C" /> : <Copy size={14} />}
            </div>
          )}

          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '24px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            {fiatSymbol}{(totalUsd * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: '1rem', color: totalChange >= 0 ? '#A3BE8C' : '#BF616A', fontWeight: '500' }}>
              {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={() => setShowModal(true)}
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)',
              padding: '10px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sidebar)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Plus size={16} /> Add Custom Crypto
          </button>

          <NetworkSelector 
            value={selectedChain}
            onChange={(val) => setSelectedChain(val)}
            showAllOption={true}
          />

          <button 
            onClick={fetchPortfolio} 
            disabled={loading}
            style={{
              background: 'var(--accent)',
              color: 'var(--bg-secondary)',
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
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'var(--accent)')}
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
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--accent)' }}>
          <div className="dot" style={{ background: 'var(--accent)', animation: 'pulse 1s infinite', display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', marginRight: '8px' }}></div>
          Scanning blockchains...
        </div>
      )}

      {data && flatTokens.length > 0 && (
        <div style={{ 
          background: 'var(--bg-secondary)', 
          borderRadius: '12px', 
          border: '1px solid var(--glass-border)', 
          overflow: 'hidden',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
          marginBottom: '32px'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 1fr 1fr 1fr', 
            gap: '16px', 
            padding: '16px 24px', 
            background: 'var(--bg-sidebar)', 
            borderBottom: '1px solid var(--glass-border)', 
            color: 'var(--text-secondary)', 
            fontWeight: '600', 
            fontSize: '0.85rem',
            letterSpacing: '1px'
          }}>
            <div>TOKEN</div>
            <div style={{ textAlign: 'right' }}>PRICE</div>
            <div style={{ textAlign: 'right' }}>AMOUNT</div>
            <div style={{ textAlign: 'right' }}>VALUE ({baseFiat.toUpperCase()})</div>
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
                  borderBottom: idx === flatTokens.length - 1 ? 'none' : '1px solid var(--glass-border)',
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
                        color: t.isNative ? 'var(--accent)' : '#A3BE8C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '0.9rem', overflow: 'hidden'
                      }}>
                        <span style={{ position: 'absolute', zIndex: 1 }}>{(t.symbol || '???').substring(0, 3)}</span>
                        <img 
                          src={getTokenLogoUrl(t.chain, t.address, t.isNative)} 
                          alt={t.symbol || 'token'} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 2, background: 'var(--bg-secondary)' }} 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      
                      <div style={{
                        position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px',
                        borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 3, padding: '2px'
                      }}>
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '50%',
                          background: getChainColor(t.chain), overflow: 'hidden'
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
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.1rem' }}>{t.symbol || 'Unknown'}</span>
                  </div>
                  
                  <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    {t.priceUsd ? `${fiatSymbol}${(t.priceUsd * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '-'}
                  </div>
                  
                  <div style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: '600' }}>
                    {formatBalance(t.balanceRaw, t.decimals)} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{t.symbol || ''}</span>
                  </div>
                  
                  <div style={{ textAlign: 'right', color: '#A3BE8C', fontWeight: '600', fontSize: '1.1rem' }}>
                    {usdVal > 0 ? `${fiatSymbol}${(usdVal * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${fiatSymbol}0.00`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {whitelist.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '16px' }}>Whitelisted Tokens</h2>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            borderRadius: '12px', 
            border: '1px solid var(--glass-border)', 
            overflow: 'hidden'
          }}>
            {whitelist.map((t, idx) => (
              <div key={`${t.chainName}-${t.address}`} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: idx === whitelist.length - 1 ? 'none' : '1px solid var(--glass-border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: getChainColor(t.chainName), overflow: 'hidden'
                  }}>
                    <img src={getChainLogoUrl(t.chainName)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{t.symbol || 'Unknown'}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{t.address}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveToken(t.chainName, t.address)}
                  style={{ background: 'rgba(191, 97, 106, 0.1)', color: '#BF616A', border: '1px solid rgba(191, 97, 106, 0.2)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-secondary)', width: '100%', maxWidth: '400px',
            borderRadius: '16px', padding: '24px', border: '1px solid var(--glass-border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
              <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Custom crypto</h2>
              <div style={{ width: '20px' }}></div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>Network</label>
              <NetworkSelector value={customChain} onChange={setCustomChain} showAllOption={false} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>Contract address</label>
              <input 
                type="text" 
                value={customCa}
                onChange={handleCaChange}
                placeholder="Enter contract information"
                style={{
                  width: '100%', background: 'var(--bg-sidebar)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>Symbol</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={customSymbol}
                  readOnly
                  placeholder={fetchingMetadata ? "Fetching..." : ""}
                  style={{
                    width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)', padding: '12px 16px', borderRadius: '8px', outline: 'none',
                    opacity: 0.7
                  }}
                />
                {fetchingMetadata && <div className="dot spin" style={{ position: 'absolute', right: '16px', top: '16px', width: '12px', height: '12px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>Decimal</label>
              <input 
                type="text" 
                value={customDecimals}
                readOnly
                placeholder={fetchingMetadata ? "Fetching..." : ""}
                style={{
                  width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)', padding: '12px 16px', borderRadius: '8px', outline: 'none',
                  opacity: 0.7
                }}
              />
            </div>

            <button 
              onClick={handleAddCustomToken}
              disabled={!customSymbol || addingCustom}
              style={{
                width: '100%', background: (!customSymbol || addingCustom) ? 'var(--tool-bg)' : 'var(--text-primary)',
                color: (!customSymbol || addingCustom) ? 'var(--text-secondary)' : 'var(--bg-secondary)',
                border: 'none', padding: '14px', borderRadius: '24px',
                fontWeight: 'bold', fontSize: '1rem', cursor: (!customSymbol || addingCustom) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {addingCustom ? 'Confirming...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
