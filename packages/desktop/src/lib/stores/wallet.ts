import { writable } from 'svelte/store';
import { apiFetch } from '$lib/utils/api';

export interface TokenBalance {
  symbol: string;
  address: string;
  balanceRaw: string;
  decimals: number;
  isNative: boolean;
  priceUsd?: number;
  priceChange24h?: number;
}

export interface PortfolioData {
  [chainName: string]: TokenBalance[];
}

function createWalletStore() {
  const { subscribe, set, update } = writable({
    data: null as PortfolioData | null,
    walletAddress: '',
    isLoading: false,
    error: '',
  });

  return {
    subscribe,
    fetchPortfolio: async () => {
      update(s => ({ ...s, isLoading: true, error: '' }));
      try {
        const [resPortfolio, resWallet] = await Promise.all([
          apiFetch('/api/portfolio'),
          apiFetch('/api/wallet')
        ]);
        
        let newData = null;
        if (resPortfolio.ok) newData = await resPortfolio.json();
        
        let addr = '';
        if (resWallet.ok) {
          const wJson = await resWallet.json();
          addr = wJson.address;
        }

        update(s => ({ ...s, data: newData, walletAddress: addr, isLoading: false }));
      } catch (err: any) {
        update(s => ({ ...s, error: err.message, isLoading: false }));
      }
    }
  };
}

export const walletStore = createWalletStore();
