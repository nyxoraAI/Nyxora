import { createPublicClient, http, fallback, PublicClient, Transport, webSocket } from 'viem';
import { loadConfig } from '../../config/parser';
import { supportedChains, ChainName } from './chains';

export function getPublicClient(chainName: ChainName): PublicClient {
  const chain = supportedChains[chainName];
  if (!chain) throw new Error(`Unsupported chain: ${chainName}`);

  const config = loadConfig();
  const customRpcRaw = config.web3?.rpc_urls?.[chainName];
  
  const transports: Transport[] = [];
  
  if (customRpcRaw) {
    if (Array.isArray(customRpcRaw)) {
      customRpcRaw.forEach(url => {
        if (url.trim()) transports.push(http(url.trim(), { batch: { batchSize: 100 } }));
      });
    } else if (typeof customRpcRaw === 'string' && customRpcRaw.trim()) {
      transports.push(http(customRpcRaw.trim(), { batch: { batchSize: 100 } }));
    }
  }
  
  // Fallback public RPCs (Top tier from Chainlist.org prioritized)
  if (!customRpcRaw) {
    if (chainName === 'ethereum') {
      transports.push(http('https://rpc.mevblocker.io', { timeout: 5000, batch: { batchSize: 100 } })); // Primary MEV protection
      transports.push(http('https://rpc.flashbots.net', { timeout: 5000, batch: { batchSize: 100 } })); // Secondary MEV protection
      transports.push(http('https://ethereum-rpc.publicnode.com', { timeout: 5000, batch: { batchSize: 100 } })); // Fallback

    } else if (chainName === 'bsc') {
      transports.push(http('https://bsc-rpc.publicnode.com', { timeout: 5000, batch: { batchSize: 100 } }));
      transports.push(http('https://bsc-dataseed.binance.org', { timeout: 5000, batch: { batchSize: 100 } }));
    } else if (chainName === 'base') {
      transports.push(http('https://base-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://mainnet.base.org', { timeout: 5000 }));
    } else if (chainName === 'arbitrum') {
      transports.push(http('https://arbitrum-one-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://arb1.arbitrum.io/rpc', { timeout: 5000 }));
    } else if (chainName === 'optimism') {
      transports.push(http('https://optimism-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://mainnet.optimism.io', { timeout: 5000 }));
    } else if (chainName === 'sepolia') {
      transports.push(http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://rpc.sepolia.org', { timeout: 5000 }));
    } else if (chainName === 'polygon') {
      transports.push(http('https://polygon-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://polygon.llamarpc.com', { timeout: 5000 }));
      transports.push(http('https://polygon-rpc.com', { timeout: 5000 }));
    } else if (chainName === 'arbitrum_sepolia') {
      transports.push(http('https://arbitrum-sepolia-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://sepolia-rollup.arbitrum.io/rpc', { timeout: 5000 }));
    } else if (chainName === 'optimism_sepolia') {
      transports.push(http('https://optimism-sepolia-rpc.publicnode.com', { timeout: 5000 }));
      transports.push(http('https://sepolia.optimism.io', { timeout: 5000 }));
    }
  }

  // Always append the default public RPC (like cloudflare) as the last resort
  transports.push(http(undefined, { timeout: 5000 }));

  // @ts-ignore
  return createPublicClient({
    chain,
    transport: fallback(transports, { rank: false }),
    batch: {
      multicall: {
        batchSize: 100,
        wait: 16
      }
    }
  });
}

export function getWsClient(chainName: ChainName): PublicClient {
  const chain = supportedChains[chainName];
  if (!chain) throw new Error(`Unsupported chain: ${chainName}`);

  const config = loadConfig();
  const customRpcRaw = config.web3?.rpc_urls?.[chainName];
  let wsUrl = '';
  
  if (customRpcRaw) {
    const urls = Array.isArray(customRpcRaw) ? customRpcRaw : [customRpcRaw];
    const foundWs = urls.find(u => u.trim().startsWith('wss://') || u.trim().startsWith('ws://'));
    if (foundWs) wsUrl = foundWs.trim();
  }

  // Fallback to Public WSS if available
  if (!wsUrl) {
    if (chainName === 'ethereum') wsUrl = 'wss://ethereum-rpc.publicnode.com';
    else if (chainName === 'bsc') wsUrl = 'wss://bsc-rpc.publicnode.com';
    else if (chainName === 'base') wsUrl = 'wss://base-rpc.publicnode.com';
    else if (chainName === 'arbitrum') wsUrl = 'wss://arbitrum-one-rpc.publicnode.com';
    else if (chainName === 'optimism') wsUrl = 'wss://optimism-rpc.publicnode.com';
    else if (chainName === 'sepolia') wsUrl = 'wss://ethereum-sepolia-rpc.publicnode.com';
    else if (chainName === 'polygon') wsUrl = 'wss://polygon-rpc.publicnode.com';
    else if (chainName === 'arbitrum_sepolia') wsUrl = 'wss://arbitrum-sepolia-rpc.publicnode.com';
    else if (chainName === 'optimism_sepolia') wsUrl = 'wss://optimism-sepolia-rpc.publicnode.com';
  }

  // If WSS is totally unavailable, fallback to HTTP polling transparently
  if (!wsUrl) {
    return getPublicClient(chainName);
  }

  // @ts-ignore
  return createPublicClient({
    chain,
    transport: fallback([
      webSocket(wsUrl, { 
        retryCount: 5,
        retryDelay: 1000,
        keepAlive: true 
      }),
      // WSS Auto-Reconnect Fallback: If WS completely fails, gracefully degrade to HTTP
      http()
    ])
  });
}
