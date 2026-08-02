import { safeFetchJson, HttpError } from '../../utils/httpClient';
import { getOpenSeaHeaders } from '../../config/marketConfigManager';
import { normalizeChainName } from '../utils/chains';

export interface NftMarketStatsResult {
  collection: string;
  floorPrice: number;
  floorPriceSymbol: string;
  volume24h: number;
  totalVolume: number;
  totalOwners: number;
  totalSupply: number;
  marketCap: number;
}

export const getNftMarketStatsToolDefinition = {
  type: 'function',
  function: {
    name: 'get_nft_market_stats',
    description: 'Get real-time NFT collection market statistics, floor price, 24h volume, and owner stats from OpenSea API v2.',
    parameters: {
      type: 'object',
      properties: {
        collectionSlug: {
          type: 'string',
          description: 'The OpenSea collection slug (e.g., "pudgypenguins", "boredapeyachtclub", "azuki", "milady")'
        },
        chain: {
          type: 'string',
          description: 'Optional EVM chain name (e.g., "ethereum", "polygon", "base", "arbitrum", "optimism", "bsc", "robinhood")'
        }
      },
      required: ['collectionSlug']
    }
  }
};

export async function getNftMarketStats(collectionSlug: string, chainName?: string): Promise<string> {
  try {
    const slug = String(collectionSlug || '').trim().toLowerCase();
    if (!slug) {
      throw new Error('collectionSlug is required.');
    }

    const headers = getOpenSeaHeaders();
    const url = `https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}/stats`;

    const data = await safeFetchJson<any>(url, {
      headers,
      timeoutMs: 15000,
      retries: 1
    });

    if (!data || !data.total) {
      return `[NFT Market Oracle] Could not retrieve statistics for collection "${slug}". Please verify the collection slug.`;
    }

    const total = data.total || {};
    const intervals = data.intervals || [];
    const dayInterval = intervals.find((i: any) => i.interval === 'one_day' || i.interval === '1d') || {};

    const floorPrice = total.floor_price || 0;
    const floorSymbol = total.floor_price_symbol || 'ETH';
    const totalVolume = total.volume || 0;
    const volume24h = dayInterval.volume || 0;
    const totalOwners = total.num_owners || 0;
    const totalSupply = total.count || 0;
    const marketCap = total.market_cap || (floorPrice * totalSupply);

    const report = [
      `=== NFT MARKET ORACLE: ${slug.toUpperCase()} ===`,
      `Floor Price   : ${floorPrice} ${floorSymbol}`,
      `24h Volume    : ${volume24h.toFixed(2)} ${floorSymbol}`,
      `Total Volume  : ${totalVolume.toFixed(2)} ${floorSymbol}`,
      `Est. Mkt Cap  : ${marketCap.toFixed(2)} ${floorSymbol}`,
      `Total Owners  : ${totalOwners.toLocaleString()}`,
      `Total Supply  : ${totalSupply.toLocaleString()}`,
      `===============================================`,
      `Data Source   : OpenSea API v2`
    ].join('\n');

    return report;
  } catch (error: any) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403 || error.status === 429) {
        return `[NFT Market Oracle] API access error (HTTP ${error.status}). You can configure your OpenSea API Key from Dashboard -> Market Oracles.`;
      }
      if (error.status === 404) {
        return `[NFT Market Oracle] Collection "${collectionSlug}" not found on OpenSea.`;
      }
    }
    return `[NFT Market Oracle] Failed to retrieve NFT market stats: ${error.message}`;
  }
}
