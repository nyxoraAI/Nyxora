import fs from 'fs';
import path from 'path';
import os from 'os';

const WHITELIST_FILE_PATH = path.join(os.homedir(), '.nyxora', 'user_whitelist.json');

export interface WhitelistedToken {
  chainName: string;
  address: string;
  source: 'manual' | 'explorer' | 'swap';
  lastSeen: number;
}

export interface UserWhitelist {
  [walletAddress: string]: WhitelistedToken[];
}

export function getUserWhitelist(): UserWhitelist {
  try {
    if (!fs.existsSync(WHITELIST_FILE_PATH)) {
      return {};
    }
    const data = fs.readFileSync(WHITELIST_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);

    // Auto-migrate legacy format
    let migrated = false;
    for (const addr in parsed) {
      if (parsed[addr] && !Array.isArray(parsed[addr])) {
        const newArray: WhitelistedToken[] = [];
        for (const chain in parsed[addr]) {
          const tokens = parsed[addr][chain];
          if (Array.isArray(tokens)) {
            for (const t of tokens) {
              newArray.push({
                chainName: chain,
                address: typeof t === 'string' ? t.toLowerCase() : (t.address || '').toLowerCase(),
                source: 'manual',
                lastSeen: Date.now()
              });
            }
          }
        }
        parsed[addr] = newArray;
        migrated = true;
      }
    }

    if (migrated) {
      fs.writeFileSync(WHITELIST_FILE_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }

    return parsed;
  } catch (err) {
    console.error('[Whitelist] Error reading user_whitelist.json', err);
    return {};
  }
}

export function saveTokenToWhitelist(walletAddress: string, chainName: string, tokenAddress: string, source: 'manual' | 'explorer' | 'swap' = 'manual') {
  try {
    const whitelist = getUserWhitelist();
    const addr = walletAddress.toLowerCase();
    const tokenAddr = tokenAddress.toLowerCase();

    if (!whitelist[addr]) whitelist[addr] = [];

    const existingIndex = whitelist[addr].findIndex(t => t.chainName === chainName && t.address === tokenAddr);
    
    if (existingIndex >= 0) {
      whitelist[addr][existingIndex].lastSeen = Date.now();
    } else {
      whitelist[addr].push({
        chainName,
        address: tokenAddr,
        source,
        lastSeen: Date.now()
      });
      console.log(`[Whitelist] Added ${tokenAddr} to ${chainName} for ${addr} via ${source}`);
    }

    fs.writeFileSync(WHITELIST_FILE_PATH, JSON.stringify(whitelist, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Whitelist] Error saving token to user_whitelist.json', err);
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
      fs.writeFileSync(WHITELIST_FILE_PATH, JSON.stringify(whitelist, null, 2), 'utf-8');
      console.log(`[Whitelist] Removed garbage token ${tokenAddr} on ${chainName} for ${addr}`);
    }
  } catch (err) {
    console.error('[Whitelist] Error removing token from user_whitelist.json', err);
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
