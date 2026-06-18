import { ChainName } from './chains';
import { loadDefiKeys } from '../../config/defiConfigManager';
import { getPublicClient } from './rpcEngine';
import { safeFetchJson } from '../../utils/httpClient';

export interface ZerionPosition {
  type: string;
  attributes: {
    name: string;
    symbol: string;
    quantity: { int: string; decimals: number; numeric: number };
    value: number;
    price: number;
    fungible_info: {
      implementations: Array<{ address: string; chain_id: string }>;
    };
  };
}

// Convert Zerion network names to our chain names
const ZERION_CHAIN_MAP: Record<string, string> = {
  'ethereum': 'ethereum',
  'base': 'base',
  'binance-smart-chain': 'bsc',
  'arbitrum': 'arbitrum',
  'optimism': 'optimism',
  'polygon': 'polygon'
};

export async function fetchZerionPortfolio(address: string): Promise<Record<string, any[]>> {
  const keys = loadDefiKeys();
  if (!keys.zerion_key) {
    console.warn('[Zerion] No API Key found, skipping Zerion fetch.');
    return {};
  }

  try {
    const data = await safeFetchJson<any>(`https://api.zerion.io/v1/wallets/${address}/positions`, {
      headers: {
        'accept': 'application/json',
        'authorization': `Basic ${Buffer.from(keys.zerion_key + ':').toString('base64')}`
      }
    });
    
    const portfolio: Record<string, any[]> = {};
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((pos: ZerionPosition) => {
        if (pos.type !== 'positions') return;
        
        const impl = pos.attributes.fungible_info?.implementations?.[0];
        if (!impl) return;

        const chainName = ZERION_CHAIN_MAP[impl.chain_id];
        if (!chainName) return;

        if (!portfolio[chainName]) portfolio[chainName] = [];
        
        portfolio[chainName].push({
          symbol: pos.attributes.symbol,
          name: pos.attributes.name,
          address: impl.address || 'native',
          balanceRaw: pos.attributes.quantity.int,
          decimals: pos.attributes.quantity.decimals,
          priceUsd: pos.attributes.price,
          valueUsd: pos.attributes.value,
          isNative: !impl.address
        });
      });
    }

    return portfolio;
  } catch (error) {
    console.error('[Zerion] Fetch failed:', error);
    return {};
  }
}
