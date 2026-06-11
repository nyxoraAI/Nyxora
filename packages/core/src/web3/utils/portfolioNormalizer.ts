import { ChainName } from './chains';
import { removeTokenFromWhitelist } from '../../utils/userWhitelistManager';
import { analyzeMarketEngine } from './marketEngine';

export interface NormalizedToken {
  symbol: string;
  name: string;
  address: string;
  balanceRaw: string;
  decimals: number;
  isNative: boolean;
  priceUsd: number;
  valueUsd: number;
  source: 'zerion' | 'rpc';
}

export async function normalizeAndMergePortfolio(
  walletAddress: string,
  chainName: ChainName,
  rpcTokens: any[], 
  zerionTokens: any[]
): Promise<NormalizedToken[]> {
  const merged: Record<string, NormalizedToken> = {};

  // 1. Process RPC Tokens (Highly Accurate Balances, but might lack prices)
  for (const t of rpcTokens) {
    const key = t.address.toLowerCase();
    merged[key] = {
      symbol: t.symbol,
      name: t.symbol,
      address: t.address,
      balanceRaw: t.balanceRaw,
      decimals: t.decimals,
      isNative: t.isNative,
      priceUsd: 0,
      valueUsd: 0,
      source: 'rpc'
    };
  }

  // 2. Process Zerion Tokens (Has pricing, might be delayed)
  for (const t of zerionTokens) {
    const key = t.address.toLowerCase();
    if (merged[key]) {
      // Resolve Collision: Use RPC balance (fresher), but use Zerion price
      merged[key].priceUsd = t.priceUsd || 0;
      merged[key].name = t.name || merged[key].symbol;
      
      // Calculate value based on RPC balance and Zerion price
      const balNum = Number(BigInt(merged[key].balanceRaw)) / Math.pow(10, merged[key].decimals);
      merged[key].valueUsd = balNum * merged[key].priceUsd;
    } else {
      // Token found by Zerion but not in our whitelist/RPC scan
      merged[key] = {
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        balanceRaw: t.balanceRaw,
        decimals: t.decimals,
        isNative: t.isNative,
        priceUsd: t.priceUsd,
        valueUsd: t.valueUsd,
        source: 'zerion'
      };
    }
  }

  const finalTokens: NormalizedToken[] = [];
  
  // 3. Garbage Collection & Output Filtering
  for (const [key, t] of Object.entries(merged)) {
    const balNum = Number(BigInt(t.balanceRaw)) / Math.pow(10, t.decimals);

    // Criteria 1: Zero Balance
    if (balNum === 0) {
      if (!t.isNative) removeTokenFromWhitelist(walletAddress, chainName, t.address);
      continue; // Skip rendering
    }

    // Criteria 2: Dust (Value < $0.01)
    if (t.priceUsd > 0 && t.valueUsd < 0.01) {
      if (!t.isNative) removeTokenFromWhitelist(walletAddress, chainName, t.address);
      continue; // Skip rendering
    }

    // Criteria 3: Rugpull / Dead Token Check
    // If Zerion doesn't have a price, we could check DexScreener, but for performance, 
    // we assume if it's in the whitelist and has balance, we show it, unless we actively verify it's a rug.
    // For now, if value is 0 because price is 0, we still show it (could be a new memecoin),
    // but if it's explicitly verified as dead, we'd remove it. (Placeholder for advanced rug check).

    finalTokens.push(t);
  }

  // Sort by Value USD (Highest first)
  return finalTokens.sort((a, b) => b.valueUsd - a.valueUsd);
}
