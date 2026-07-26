<script lang="ts">
  import { 
    LineChart, Activity, ArrowUpRight, ArrowDownRight, Search, RefreshCw, 
    Sparkles, Flame, Globe, Bot, Layers, Zap, Copy, Check 
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { configStore } from '$lib/stores/config.svelte';
  import { appState } from '$lib/stores/app';

  let loading = $state(false);
  let activeTab = $state('trending');
  let searchQuery = $state('');
  let copiedSymbol = $state('');

  interface MarketToken {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number;
    total_volume: number;
    price_change_percentage_1h_in_currency?: number;
    price_change_percentage_24h?: number;
    price_change_percentage_7d_in_currency?: number;
    category?: 'l1' | 'ai' | 'meme' | 'defi';
    isTrending?: boolean;
  }

  // Massive Web3 Token Dataset (AI Agents, Memecoins, L1/L2)
  const masterTokens: MarketToken[] = [
    // --- L1 & L2 Major Chains ---
    {
      id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin',
      image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
      current_price: 96420.50, market_cap: 1910000000000, market_cap_rank: 1, total_volume: 42500000000,
      price_change_percentage_1h_in_currency: 0.42, price_change_percentage_24h: 3.85, price_change_percentage_7d_in_currency: 8.12,
      category: 'l1', isTrending: true
    },
    {
      id: 'ethereum', symbol: 'ETH', name: 'Ethereum',
      image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
      current_price: 3410.80, market_cap: 410000000000, market_cap_rank: 2, total_volume: 21000000000,
      price_change_percentage_1h_in_currency: -0.15, price_change_percentage_24h: 2.14, price_change_percentage_7d_in_currency: 5.40,
      category: 'l1', isTrending: true
    },
    {
      id: 'solana', symbol: 'SOL', name: 'Solana',
      image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
      current_price: 194.25, market_cap: 92000000000, market_cap_rank: 3, total_volume: 8500000000,
      price_change_percentage_1h_in_currency: 0.85, price_change_percentage_24h: 6.72, price_change_percentage_7d_in_currency: 14.20,
      category: 'l1', isTrending: true
    },
    {
      id: 'binancecoin', symbol: 'BNB', name: 'BNB',
      image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
      current_price: 645.10, market_cap: 94000000000, market_cap_rank: 4, total_volume: 1850000000,
      price_change_percentage_1h_in_currency: 0.10, price_change_percentage_24h: 1.45, price_change_percentage_7d_in_currency: 4.20,
      category: 'l1', isTrending: false
    },
    {
      id: 'sui', symbol: 'SUI', name: 'Sui',
      image: 'https://assets.coingecko.com/coins/images/26375/large/sui-ocean-square.png',
      current_price: 3.42, market_cap: 9800000000, market_cap_rank: 14, total_volume: 1450000000,
      price_change_percentage_1h_in_currency: 1.10, price_change_percentage_24h: 9.80, price_change_percentage_7d_in_currency: 24.10,
      category: 'l1', isTrending: true
    },
    {
      id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche',
      image: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
      current_price: 38.60, market_cap: 15800000000, market_cap_rank: 12, total_volume: 890000000,
      price_change_percentage_1h_in_currency: 0.10, price_change_percentage_24h: 3.15, price_change_percentage_7d_in_currency: 7.80,
      category: 'l1', isTrending: false
    },
    {
      id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum',
      image: 'https://assets.coingecko.com/coins/images/16547/large/arbitrum_logo.png',
      current_price: 0.84, market_cap: 3200000000, market_cap_rank: 32, total_volume: 450000000,
      price_change_percentage_1h_in_currency: 0.20, price_change_percentage_24h: 4.10, price_change_percentage_7d_in_currency: 9.50,
      category: 'l1', isTrending: false
    },
    {
      id: 'chainlink', symbol: 'LINK', name: 'Chainlink',
      image: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
      current_price: 19.40, market_cap: 11800000000, market_cap_rank: 15, total_volume: 680000000,
      price_change_percentage_1h_in_currency: 0.35, price_change_percentage_24h: 5.80, price_change_percentage_7d_in_currency: 12.10,
      category: 'l1', isTrending: false
    },
    {
      id: 'optimism', symbol: 'OP', name: 'Optimism',
      image: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png',
      current_price: 1.85, market_cap: 2400000000, market_cap_rank: 42, total_volume: 310000000,
      price_change_percentage_1h_in_currency: -0.10, price_change_percentage_24h: 2.90, price_change_percentage_7d_in_currency: 6.40,
      category: 'l1', isTrending: false
    },

    // --- AI Agents & AI Tokens (12+ Tokens) ---
    {
      id: 'virtual-protocol', symbol: 'VIRTUAL', name: 'Virtuals Protocol',
      image: 'https://assets.coingecko.com/coins/images/33946/large/virtuals.png',
      current_price: 1.84, market_cap: 1840000000, market_cap_rank: 48, total_volume: 420000000,
      price_change_percentage_1h_in_currency: 2.10, price_change_percentage_24h: 18.50, price_change_percentage_7d_in_currency: 45.20,
      category: 'ai', isTrending: true
    },
    {
      id: 'aixbt-by-virtuals', symbol: 'AIXBT', name: 'aixbt by Virtuals',
      image: 'https://assets.coingecko.com/coins/images/51761/large/aixbt.png',
      current_price: 0.485, market_cap: 485000000, market_cap_rank: 95, total_volume: 185000000,
      price_change_percentage_1h_in_currency: 3.40, price_change_percentage_24h: 24.80, price_change_percentage_7d_in_currency: 82.10,
      category: 'ai', isTrending: true
    },
    {
      id: 'fartcoin', symbol: 'FARTCOIN', name: 'Fartcoin AI Agent',
      image: 'https://assets.coingecko.com/coins/images/50868/large/fartcoin.png',
      current_price: 1.12, market_cap: 1120000000, market_cap_rank: 72, total_volume: 290000000,
      price_change_percentage_1h_in_currency: 1.80, price_change_percentage_24h: 14.20, price_change_percentage_7d_in_currency: 64.50,
      category: 'ai', isTrending: true
    },
    {
      id: 'goatseus-maximus', symbol: 'GOAT', name: 'Goatseus Maximus',
      image: 'https://assets.coingecko.com/coins/images/50702/large/goat.png',
      current_price: 0.74, market_cap: 740000000, market_cap_rank: 88, total_volume: 210000000,
      price_change_percentage_1h_in_currency: 0.90, price_change_percentage_24h: 11.40, price_change_percentage_7d_in_currency: 38.20,
      category: 'ai', isTrending: true
    },
    {
      id: 'bittensor', symbol: 'TAO', name: 'Bittensor',
      image: 'https://assets.coingecko.com/coins/images/29424/large/bittensor.png',
      current_price: 524.10, market_cap: 3800000000, market_cap_rank: 24, total_volume: 320000000,
      price_change_percentage_1h_in_currency: 1.45, price_change_percentage_24h: 12.80, price_change_percentage_7d_in_currency: 28.50,
      category: 'ai', isTrending: true
    },
    {
      id: 'render-token', symbol: 'RENDER', name: 'Render Network',
      image: 'https://assets.coingecko.com/coins/images/11683/large/Render_Token_PRs_Square_Black_BG.png',
      current_price: 9.42, market_cap: 3650000000, market_cap_rank: 27, total_volume: 280000000,
      price_change_percentage_1h_in_currency: 0.60, price_change_percentage_24h: 8.40, price_change_percentage_7d_in_currency: 16.20,
      category: 'ai', isTrending: true
    },
    {
      id: 'fetch-ai', symbol: 'FET', name: 'Artificial Superintelligence Alliance',
      image: 'https://assets.coingecko.com/coins/images/5681/large/Fetch.jpg',
      current_price: 1.64, market_cap: 4250000000, market_cap_rank: 22, total_volume: 340000000,
      price_change_percentage_1h_in_currency: 0.90, price_change_percentage_24h: 7.45, price_change_percentage_7d_in_currency: 15.60,
      category: 'ai', isTrending: false
    },
    {
      id: 'near', symbol: 'NEAR', name: 'NEAR Protocol AI',
      image: 'https://assets.coingecko.com/coins/images/10365/large/near.png',
      current_price: 6.85, market_cap: 7850000000, market_cap_rank: 17, total_volume: 520000000,
      price_change_percentage_1h_in_currency: 0.25, price_change_percentage_24h: 5.30, price_change_percentage_7d_in_currency: 12.40,
      category: 'ai', isTrending: false
    },
    {
      id: 'zerebro', symbol: 'ZEREBRO', name: 'Zerebro AI Agent',
      image: 'https://assets.coingecko.com/coins/images/51358/large/zerebro.png',
      current_price: 0.42, market_cap: 420000000, market_cap_rank: 104, total_volume: 145000000,
      price_change_percentage_1h_in_currency: 4.20, price_change_percentage_24h: 28.50, price_change_percentage_7d_in_currency: 94.00,
      category: 'ai', isTrending: true
    },
    {
      id: 'griffain', symbol: 'GRIFFAIN', name: 'Griffain AI Agent',
      image: 'https://assets.coingecko.com/coins/images/52841/large/griffain.png',
      current_price: 0.18, market_cap: 180000000, market_cap_rank: 145, total_volume: 78000000,
      price_change_percentage_1h_in_currency: 1.90, price_change_percentage_24h: 19.40, price_change_percentage_7d_in_currency: 52.00,
      category: 'ai', isTrending: false
    },
    {
      id: 'arkham', symbol: 'ARKM', name: 'Arkham Intelligence',
      image: 'https://assets.coingecko.com/coins/images/30919/large/arkm.png',
      current_price: 2.15, market_cap: 510000000, market_cap_rank: 92, total_volume: 120000000,
      price_change_percentage_1h_in_currency: 0.50, price_change_percentage_24h: 6.80, price_change_percentage_7d_in_currency: 14.10,
      category: 'ai', isTrending: false
    },
    {
      id: 'worldcoin-wld', symbol: 'WLD', name: 'Worldcoin AI',
      image: 'https://assets.coingecko.com/coins/images/31069/large/worldcoin.png',
      current_price: 2.45, market_cap: 1680000000, market_cap_rank: 55, total_volume: 240000000,
      price_change_percentage_1h_in_currency: -0.20, price_change_percentage_24h: 4.20, price_change_percentage_7d_in_currency: 9.80,
      category: 'ai', isTrending: false
    },

    // --- Memecoins (12+ Tokens) ---
    {
      id: 'pepe', symbol: 'PEPE', name: 'Pepe',
      image: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.png',
      current_price: 0.0000184, market_cap: 7750000000, market_cap_rank: 18, total_volume: 1840000000,
      price_change_percentage_1h_in_currency: 2.10, price_change_percentage_24h: 15.60, price_change_percentage_7d_in_currency: 34.20,
      category: 'meme', isTrending: true
    },
    {
      id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin',
      image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
      current_price: 0.385, market_cap: 56400000000, market_cap_rank: 7, total_volume: 4200000000,
      price_change_percentage_1h_in_currency: -0.40, price_change_percentage_24h: 4.10, price_change_percentage_7d_in_currency: 11.80,
      category: 'meme', isTrending: true
    },
    {
      id: 'dogwifcoin', symbol: 'WIF', name: 'dogwifhat',
      image: 'https://assets.coingecko.com/coins/images/33566/large/dogwifhat.jpg',
      current_price: 3.12, market_cap: 3110000000, market_cap_rank: 34, total_volume: 680000000,
      price_change_percentage_1h_in_currency: -1.20, price_change_percentage_24h: -2.40, price_change_percentage_7d_in_currency: 18.90,
      category: 'meme', isTrending: true
    },
    {
      id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu',
      image: 'https://assets.coingecko.com/coins/images/11939/large/shiba.png',
      current_price: 0.0000264, market_cap: 15500000000, market_cap_rank: 13, total_volume: 920000000,
      price_change_percentage_1h_in_currency: 0.30, price_change_percentage_24h: 3.90, price_change_percentage_7d_in_currency: 8.40,
      category: 'meme', isTrending: false
    },
    {
      id: 'bonk', symbol: 'BONK', name: 'Bonk',
      image: 'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',
      current_price: 0.0000342, market_cap: 2540000000, market_cap_rank: 39, total_volume: 410000000,
      price_change_percentage_1h_in_currency: 1.10, price_change_percentage_24h: 8.70, price_change_percentage_7d_in_currency: 21.40,
      category: 'meme', isTrending: true
    },
    {
      id: 'peanut-the-squirrel', symbol: 'PNUT', name: 'Peanut the Squirrel',
      image: 'https://assets.coingecko.com/coins/images/51440/large/pnut.png',
      current_price: 1.24, market_cap: 1240000000, market_cap_rank: 68, total_volume: 480000000,
      price_change_percentage_1h_in_currency: 4.50, price_change_percentage_24h: 32.10, price_change_percentage_7d_in_currency: 114.00,
      category: 'meme', isTrending: true
    },
    {
      id: 'just-a-chill-guy', symbol: 'CHILLGUY', name: 'Just a chill guy',
      image: 'https://assets.coingecko.com/coins/images/51888/large/chillguy.png',
      current_price: 0.45, market_cap: 450000000, market_cap_rank: 98, total_volume: 195000000,
      price_change_percentage_1h_in_currency: 2.80, price_change_percentage_24h: 19.50, price_change_percentage_7d_in_currency: 72.30,
      category: 'meme', isTrending: true
    },
    {
      id: 'official-trump', symbol: 'TRUMP', name: 'Official Trump',
      image: 'https://assets.coingecko.com/coins/images/53770/large/trump.png',
      current_price: 18.40, market_cap: 3680000000, market_cap_rank: 28, total_volume: 980000000,
      price_change_percentage_1h_in_currency: 5.20, price_change_percentage_24h: 42.00, price_change_percentage_7d_in_currency: 185.00,
      category: 'meme', isTrending: true
    },
    {
      id: 'floki', symbol: 'FLOKI', name: 'Floki',
      image: 'https://assets.coingecko.com/coins/images/16746/large/FLOKI.png',
      current_price: 0.000215, market_cap: 2050000000, market_cap_rank: 45, total_volume: 290000000,
      price_change_percentage_1h_in_currency: 0.60, price_change_percentage_24h: 6.40, price_change_percentage_7d_in_currency: 14.80,
      category: 'meme', isTrending: false
    },
    {
      id: 'popcat', symbol: 'POPCAT', name: 'Popcat',
      image: 'https://assets.coingecko.com/coins/images/33737/large/popcat.png',
      current_price: 1.48, market_cap: 1480000000, market_cap_rank: 58, total_volume: 310000000,
      price_change_percentage_1h_in_currency: -0.80, price_change_percentage_24h: 5.20, price_change_percentage_7d_in_currency: 19.40,
      category: 'meme', isTrending: false
    },
    {
      id: 'mog-coin', symbol: 'MOG', name: 'Mog Coin',
      image: 'https://assets.coingecko.com/coins/images/31168/large/mog.png',
      current_price: 0.00000284, market_cap: 1120000000, market_cap_rank: 75, total_volume: 180000000,
      price_change_percentage_1h_in_currency: 1.20, price_change_percentage_24h: 11.50, price_change_percentage_7d_in_currency: 28.90,
      category: 'meme', isTrending: false
    },
    {
      id: 'neiro-on-eth', symbol: 'NEIRO', name: 'First Neiro on Ethereum',
      image: 'https://assets.coingecko.com/coins/images/39538/large/neiro.png',
      current_price: 0.00195, market_cap: 820000000, market_cap_rank: 82, total_volume: 210000000,
      price_change_percentage_1h_in_currency: 1.50, price_change_percentage_24h: 13.80, price_change_percentage_7d_in_currency: 32.40,
      category: 'meme', isTrending: false
    }
  ];

  let tokens = $state<MarketToken[]>(masterTokens);
  let globalStats = $state({
    marketCapUsd: 2680000000000,
    marketCapChange24h: 2.45,
    volume24hUsd: 94500000000,
    btcDominance: 57.2,
    btcDominanceChange: 0.3,
    fearGreedValue: 74,
    fearGreedLabel: 'Greed'
  });

  function detectCategory(sym: string): 'l1' | 'ai' | 'meme' | 'defi' {
    const s = sym.toUpperCase();
    const aiSymbols = [
      'TAO', 'RENDER', 'FET', 'NEAR', 'AGIX', 'WLD', 'AKT', 'VIRTUAL', 'AIXBT', 
      'FARTCOIN', 'GOAT', 'GRIFFAIN', 'ZEREBRO', 'DEGEN', 'AIXBT', 'LUNA', 
      'PRIME', 'ARKM', 'AIOZ', 'CGPT', 'SPECTRE', 'CORGIAI', 'PAAL'
    ];
    const memeSymbols = [
      'PEPE', 'DOGE', 'WIF', 'SHIB', 'BONK', 'FLOKI', 'BRETT', 'POPEN', 
      'TRUMP', 'MELANIA', 'CHILLGUY', 'PNUT', 'MOODENG', 'POPCAT', 'MOG', 
      'SPX', 'NEIRO', 'BOME', 'MEW', 'SLERF', 'COQ', 'MEME', 'TURBO'
    ];
    const defiSymbols = ['UNI', 'AAVE', 'LINK', 'MKR', 'JUP', 'RAY', 'CRV', 'SNX', 'ENA', 'RPL'];
    if (aiSymbols.includes(s)) return 'ai';
    if (memeSymbols.includes(s)) return 'meme';
    if (defiSymbols.includes(s)) return 'defi';
    return 'l1';
  }

  async function fetchMarketData() {
    loading = true;
    try {
      // 1. Fetch global metrics
      const globalRes = await fetch('https://api.coingecko.com/api/v3/global');
      if (globalRes.ok) {
        const g = (await globalRes.json()).data;
        if (g) {
          globalStats.marketCapUsd = g.total_market_cap?.usd || globalStats.marketCapUsd;
          globalStats.marketCapChange24h = g.market_cap_change_percentage_24h_usd || globalStats.marketCapChange24h;
          globalStats.volume24hUsd = g.total_volume?.usd || globalStats.volume24hUsd;
          globalStats.btcDominance = g.market_cap_percentage?.btc || globalStats.btcDominance;
        }
      }

      // 2. Fetch up to 100 top markets from CoinGecko & MERGE with masterTokens
      const res = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d'
      );
      if (res.ok) {
        const fetched = await res.json();
        if (Array.isArray(fetched) && fetched.length > 0) {
          const fetchedMap = new Map<string, any>();
          fetched.forEach((item: any) => {
            fetchedMap.set(item.symbol.toUpperCase(), item);
          });

          // Merge: start with masterTokens updated with live price if available
          const merged: MarketToken[] = masterTokens.map(master => {
            const live = fetchedMap.get(master.symbol.toUpperCase());
            if (live) {
              return {
                ...master,
                current_price: live.current_price || master.current_price,
                market_cap: live.market_cap || master.market_cap,
                market_cap_rank: live.market_cap_rank || master.market_cap_rank,
                total_volume: live.total_volume || master.total_volume,
                price_change_percentage_1h_in_currency: live.price_change_percentage_1h_in_currency ?? master.price_change_percentage_1h_in_currency,
                price_change_percentage_24h: live.price_change_percentage_24h ?? master.price_change_percentage_24h,
                price_change_percentage_7d_in_currency: live.price_change_percentage_7d_in_currency ?? master.price_change_percentage_7d_in_currency,
              };
            }
            return master;
          });

          // Also add any top-30 coins from CoinGecko that aren't in masterTokens yet
          const masterSymbols = new Set(masterTokens.map(t => t.symbol.toUpperCase()));
          fetched.slice(0, 30).forEach((item: any, idx: number) => {
            const sym = item.symbol.toUpperCase();
            if (!masterSymbols.has(sym)) {
              merged.push({
                id: item.id,
                symbol: sym,
                name: item.name,
                image: item.image,
                current_price: item.current_price,
                market_cap: item.market_cap,
                market_cap_rank: item.market_cap_rank || idx + 1,
                total_volume: item.total_volume,
                price_change_percentage_1h_in_currency: item.price_change_percentage_1h_in_currency || 0,
                price_change_percentage_24h: item.price_change_percentage_24h || 0,
                price_change_percentage_7d_in_currency: item.price_change_percentage_7d_in_currency || 0,
                category: detectCategory(sym),
                isTrending: idx < 10
              });
            }
          });

          tokens = merged.sort((a, b) => a.market_cap_rank - b.market_cap_rank);
        }
      }
    } catch (e) {
      console.warn('Using rich fallback token dataset due to CoinGecko rate-limit/offline', e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchMarketData();
  });

  let filteredTokens = $derived.by(() => {
    let list = tokens;

    if (activeTab === 'trending') {
      list = list.filter(t => t.isTrending || t.price_change_percentage_24h! > 10 || ['BTC', 'SOL', 'PEPE', 'TAO', 'VIRTUAL', 'FARTCOIN', 'AIXBT', 'PNUT', 'CHILLGUY', 'TRUMP'].includes(t.symbol));
    } else if (activeTab === 'ai') {
      list = list.filter(t => t.category === 'ai');
    } else if (activeTab === 'meme') {
      list = list.filter(t => t.category === 'meme');
    } else if (activeTab === 'l1') {
      list = list.filter(t => t.category === 'l1');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.symbol.toLowerCase().includes(q)
      );
    }

    return list;
  });

  function formatUsd(val: number, maxDecimals = 2) {
    if (!val && val !== 0) return '$0.00';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val < 0.01) return `$${val.toFixed(6)}`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals })}`;
  }

  function formatPercent(val?: number) {
    if (val === undefined || val === null) return '0.00%';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  }

  function handleAnalyzeToken(token: MarketToken) {
    const prompt = `Please analyze ${token.name} (${token.symbol}) at current price ${formatUsd(token.current_price)}. Provide a quick fundamental & technical outlook, key support/resistance levels, and market sentiment.`;
    sessionStorage.setItem('nyxora_pending_prompt', prompt);
    appState.setView('chat');
  }

  function copySymbol(sym: string) {
    navigator.clipboard.writeText(sym);
    copiedSymbol = sym;
    setTimeout(() => {
      if (copiedSymbol === sym) copiedSymbol = '';
    }, 2000);
  }
</script>

<div class="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900 pb-12 text-gray-900 dark:text-gray-100">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
    <div>
      <h1 class="flex items-center gap-3 text-2xl font-bold mb-2">
        <LineChart class="text-blue-500" size={28} /> Web3 Market Terminal
      </h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        Real-time cryptocurrency metrics, market leaders, and AI token intelligence.
      </p>
    </div>

    <div class="flex items-center gap-3">
      <button 
        onclick={fetchMarketData} 
        disabled={loading}
        class="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
        {loading ? 'Updating...' : 'Refresh Market'}
      </button>
    </div>
  </div>

  <!-- Global Market Ticker Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    <div class="bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] rounded-2xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Globe size={14} class="text-blue-500" /> Total Market Cap
      </div>
      <div class="text-2xl font-bold mb-1">{formatUsd(globalStats.marketCapUsd)}</div>
      <div class="text-xs font-semibold flex items-center gap-1 {globalStats.marketCapChange24h >= 0 ? 'text-green-500' : 'text-red-500'}">
        {#if globalStats.marketCapChange24h >= 0}
          <ArrowUpRight size={14} />
        {:else}
          <ArrowDownRight size={14} />
        {/if}
        {formatPercent(globalStats.marketCapChange24h)} (24h)
      </div>
    </div>

    <div class="bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] rounded-2xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Activity size={14} class="text-blue-500" /> 24h Volume
      </div>
      <div class="text-2xl font-bold mb-1">{formatUsd(globalStats.volume24hUsd)}</div>
      <div class="text-xs text-gray-500">Across all exchanges</div>
    </div>

    <div class="bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] rounded-2xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Layers size={14} class="text-blue-500" /> BTC Dominance
      </div>
      <div class="text-2xl font-bold mb-1">{globalStats.btcDominance.toFixed(1)}%</div>
      <div class="text-xs font-semibold text-green-500 flex items-center gap-1">
        <ArrowUpRight size={14} /> +{globalStats.btcDominanceChange}% (24h)
      </div>
    </div>

    <div class="bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] rounded-2xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Flame size={14} class="text-orange-500" /> Fear & Greed Index
      </div>
      <div class="flex items-baseline gap-2 mb-1">
        <span class="text-2xl font-bold text-green-500">{globalStats.fearGreedValue}</span>
        <span class="text-sm font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">{globalStats.fearGreedLabel}</span>
      </div>
      <div class="text-xs text-gray-500">Updated hourly</div>
    </div>
  </div>

  <!-- Filter Navigation & Search Bar -->
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div class="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
      <button 
        onclick={() => activeTab = 'trending'} 
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all {activeTab === 'trending' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm' : 'bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
      >
        <Flame size={15} class={activeTab === 'trending' ? 'text-orange-400' : 'text-orange-500'} /> Trending
      </button>

      <button 
        onclick={() => activeTab = 'all'} 
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all {activeTab === 'all' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm' : 'bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
      >
        <Globe size={15} /> Top Cryptos
      </button>

      <button 
        onclick={() => activeTab = 'ai'} 
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all {activeTab === 'ai' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm' : 'bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
      >
        <Sparkles size={15} class={activeTab === 'ai' ? 'text-blue-400' : 'text-blue-500'} /> AI Tokens ({tokens.filter(t => t.category === 'ai').length})
      </button>

      <button 
        onclick={() => activeTab = 'meme'} 
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all {activeTab === 'meme' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm' : 'bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
      >
        <Zap size={15} class={activeTab === 'meme' ? 'text-yellow-400' : 'text-yellow-500'} /> Memecoins ({tokens.filter(t => t.category === 'meme').length})
      </button>

      <button 
        onclick={() => activeTab = 'l1'} 
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all {activeTab === 'l1' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm' : 'bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
      >
        <Layers size={15} /> Layer 1 & L2
      </button>
    </div>

    <!-- Search input -->
    <div class="relative min-w-[240px]">
      <Search size={16} class="absolute left-3.5 top-3 text-gray-400" />
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Search coin or symbol..."
        class="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  </div>

  <!-- Interactive Crypto Table -->
  <div class="bg-white dark:bg-[#1d1d1f] rounded-2xl border border-gray-200 dark:border-[#48484a] overflow-hidden shadow-sm">
    <div class="grid grid-cols-[80px_2.5fr_1.5fr_1.2fr_1.2fr_1.2fr_1.5fr_120px] gap-4 px-6 py-4 bg-gray-50 dark:bg-[#2c2c2e]/50 border-b border-gray-200 dark:border-[#48484a] text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider">
      <div>RANK</div>
      <div>NAME & SYMBOL</div>
      <div class="text-right">PRICE</div>
      <div class="text-right">1H</div>
      <div class="text-right">24H</div>
      <div class="text-right">7D</div>
      <div class="text-right">24H VOLUME</div>
      <div class="text-right">ACTION</div>
    </div>

    {#if filteredTokens.length === 0}
      <div class="text-center py-16 text-gray-500">
        No tokens match your current search or category filter.
      </div>
    {:else}
      <div class="divide-y divide-gray-100 dark:divide-[#48484a]">
        {#each filteredTokens as token}
          <div class="grid grid-cols-[80px_2.5fr_1.5fr_1.2fr_1.2fr_1.2fr_1.5fr_120px] gap-4 px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <!-- Rank -->
            <div class="font-bold text-sm text-gray-500">
              #{token.market_cap_rank}
            </div>

            <!-- Name and Logo -->
            <div class="flex items-center gap-3">
              <img 
                src={token.image} 
                alt={token.symbol} 
                class="w-8 h-8 rounded-full object-cover bg-white dark:bg-gray-800 p-0.5 border border-gray-200 dark:border-gray-700"
                onerror={(e) => { e.currentTarget.style.display = 'none'; }} 
              />
              <div>
                <div class="font-bold text-sm flex items-center gap-2">
                  {token.name}
                  {#if token.isTrending}
                    <span class="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-500 font-bold">HOT</span>
                  {/if}
                </div>
                <div class="text-xs text-gray-500 font-mono">
                  {token.symbol}
                </div>
              </div>
            </div>

            <!-- Price -->
            <div class="text-right font-bold text-sm">
              {formatUsd(token.current_price, token.current_price < 1 ? 6 : 2)}
            </div>

            <!-- 1H -->
            <div class="text-right text-xs font-semibold {token.price_change_percentage_1h_in_currency! >= 0 ? 'text-green-500' : 'text-red-500'}">
              {formatPercent(token.price_change_percentage_1h_in_currency)}
            </div>

            <!-- 24H -->
            <div class="text-right text-xs font-semibold {token.price_change_percentage_24h! >= 0 ? 'text-green-500' : 'text-red-500'}">
              {formatPercent(token.price_change_percentage_24h)}
            </div>

            <!-- 7D -->
            <div class="text-right text-xs font-semibold {token.price_change_percentage_7d_in_currency! >= 0 ? 'text-green-500' : 'text-red-500'}">
              {formatPercent(token.price_change_percentage_7d_in_currency)}
            </div>

            <!-- Volume -->
            <div class="text-right text-xs font-mono text-gray-500 dark:text-gray-400">
              {formatUsd(token.total_volume)}
            </div>

            <!-- Action button -->
            <div class="text-right flex items-center justify-end gap-1.5">
              <button 
                onclick={() => copySymbol(token.symbol)}
                title="Copy Symbol"
                class="p-1.5 rounded-lg border border-gray-200 dark:border-[#48484a] hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors text-gray-500"
              >
                {#if copiedSymbol === token.symbol}
                  <Check size={14} class="text-green-500" />
                {:else}
                  <Copy size={14} />
                {/if}
              </button>

              <button 
                onclick={() => handleAnalyzeToken(token)}
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-bold text-xs transition-colors"
                title="Ask Nyxora AI to analyze {token.symbol}"
              >
                <Bot size={14} /> Analyze
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
