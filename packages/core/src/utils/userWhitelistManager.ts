import fs from 'fs';
import path from 'path';
import os from 'os';

const WHITELIST_FILE_PATH = path.join(os.homedir(), '.nyxora', 'user_whitelist.json');

export interface UserWhitelist {
  [walletAddress: string]: {
    [chainName: string]: string[];
  };
}

export function getUserWhitelist(): UserWhitelist {
  try {
    if (!fs.existsSync(WHITELIST_FILE_PATH)) {
      return {};
    }
    const data = fs.readFileSync(WHITELIST_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Whitelist] Error reading user_whitelist.json', err);
    return {};
  }
}

export function saveTokenToWhitelist(walletAddress: string, chainName: string, tokenAddress: string) {
  try {
    const whitelist = getUserWhitelist();
    const addr = walletAddress.toLowerCase();
    const tokenAddr = tokenAddress.toLowerCase();

    if (!whitelist[addr]) whitelist[addr] = {};
    if (!whitelist[addr][chainName]) whitelist[addr][chainName] = [];

    // Avoid duplicates
    if (!whitelist[addr][chainName].includes(tokenAddr)) {
      whitelist[addr][chainName].push(tokenAddr);
      fs.writeFileSync(WHITELIST_FILE_PATH, JSON.stringify(whitelist, null, 2), 'utf-8');
      console.log(`[Whitelist] Added ${tokenAddr} to ${chainName} for ${addr}`);
    }
  } catch (err) {
    console.error('[Whitelist] Error saving token to user_whitelist.json', err);
  }
}

export function getUserTokens(walletAddress: string, chainName: string): string[] {
  const whitelist = getUserWhitelist();
  const addr = walletAddress.toLowerCase();
  return whitelist[addr]?.[chainName] || [];
}
