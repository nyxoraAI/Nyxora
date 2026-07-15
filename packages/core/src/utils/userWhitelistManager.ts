import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { getPublicClient, ChainName } from '../web3/config';
import { getTokenMetadata } from '../web3/utils/tokens';

const WHITELIST_FILE_PATH = path.join(os.homedir(), '.nyxora', 'user_whitelist.yaml');

export interface WhitelistedToken {
  chainName: string;
  address: string;
  symbol?: string;
  decimals?: number;
  source: 'manual' | 'explorer' | 'swap';
  lastSeen: number;
}

export interface UserWhitelist {
  [walletAddress: string]: WhitelistedToken[];
}

export function getUserWhitelist(): UserWhitelist {
  try {
    if (!fs.existsSync(WHITELIST_FILE_PATH)) {
      // Try migrating from JSON if YAML doesn't exist yet
      const oldJsonPath = path.join(os.homedir(), '.nyxora', 'user_whitelist.json');
      if (fs.existsSync(oldJsonPath)) {
        const data = fs.readFileSync(oldJsonPath, 'utf-8');
        const parsed = JSON.parse(data);
        fs.writeFileSync(WHITELIST_FILE_PATH, yaml.stringify(parsed), 'utf-8');
        // Rename old file so it doesn't get used again
        fs.renameSync(oldJsonPath, `${oldJsonPath}.bak`);
        return parsed;
      }
      return {};
    }
    const data = fs.readFileSync(WHITELIST_FILE_PATH, 'utf-8');
    return yaml.parse(data) || {};
  } catch (err) {
    console.error('[Whitelist] Error reading user_whitelist.yaml', err);
    return {};
  }
}

export async function saveTokenToWhitelist(
  walletAddress: string, 
  chainName: ChainName, 
  tokenAddress: string, 
  source: 'manual' | 'explorer' | 'swap' = 'manual',
  symbol?: string,
  decimals?: number
) {
  try {
    const whitelist = getUserWhitelist();
    const addr = walletAddress.toLowerCase();
    const tokenAddr = tokenAddress.toLowerCase();

    // Auto-fetch metadata if not provided
    if (!symbol || decimals === undefined) {
      try {
        const client = getPublicClient(chainName);
        const metadata = await getTokenMetadata(client, tokenAddr as `0x${string}`);
        symbol = metadata.symbol;
        decimals = metadata.decimals;
      } catch (err) {
        console.warn(`[Whitelist] Could not fetch metadata for ${tokenAddr} on ${chainName}`, err);
      }
    }

    if (!whitelist[addr]) whitelist[addr] = [];

    const existingIndex = whitelist[addr].findIndex(t => t.chainName === chainName && t.address === tokenAddr);
    
    if (existingIndex >= 0) {
      whitelist[addr][existingIndex].lastSeen = Date.now();
      if (symbol) whitelist[addr][existingIndex].symbol = symbol;
      if (decimals !== undefined) whitelist[addr][existingIndex].decimals = decimals;
    } else {
      whitelist[addr].push({
        chainName,
        address: tokenAddr,
        symbol,
        decimals,
        source,
        lastSeen: Date.now()
      });
      console.log(`[Whitelist] Added ${symbol || tokenAddr} to ${chainName} for ${addr} via ${source}`);
    }

    fs.writeFileSync(WHITELIST_FILE_PATH, yaml.stringify(whitelist), 'utf-8');
  } catch (err) {
    console.error('[Whitelist] Error saving token to user_whitelist.yaml', err);
  }
}

export function removeTokenFromWhitelist(walletAddress: string, chainName: string, tokenAddress: string) {
  try {
    const whitelist = getUserWhitelist();
    const addr = walletAddress.toLowerCase();
    const tokenAddr = tokenAddress.toLowerCase();

    if (!whitelist[addr]) return;

    const initialLength = whitelist[addr].length;
    whitelist[addr] = whitelist[addr].filter(t => !(t.chainName === chainName && t.address === tokenAddr));
    
    if (whitelist[addr].length !== initialLength) {
      fs.writeFileSync(WHITELIST_FILE_PATH, yaml.stringify(whitelist), 'utf-8');
      console.log(`[Whitelist] Removed token ${tokenAddr} on ${chainName} for ${addr}`);
    }
  } catch (err) {
    console.error('[Whitelist] Error removing token from user_whitelist.yaml', err);
  }
}

export function getUserTokens(walletAddress: string, chainName: string): string[] {
  const whitelist = getUserWhitelist();
  const addr = walletAddress.toLowerCase();
  if (!whitelist[addr]) return [];
  
  return whitelist[addr]
    .filter(t => t.chainName === chainName)
    .map(t => t.address);
}
