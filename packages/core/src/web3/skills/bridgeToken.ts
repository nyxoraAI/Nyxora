import { parseUnits } from 'viem';
import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { getAddress, submitTransaction } from '../utils/vaultClient';
import { txManager } from '../../agent/transactionManager';
import { resolveToken } from '../utils/tokens';
import { routeTransaction } from '../aggregator/defiRouter';

export async function prepareBridgeToken(
  fromChain: ChainName, 
  toChain: ChainName, 
  tokenSymbol: string, 
  amountStr: string,
  mode: "auto" | "manual" = "auto",
  providerName: "auto" | "lifi" | "relay" = "auto",
  slippagePercent?: number | "auto"
): Promise<string> {
  try {
    fromChain = String(fromChain || "") as ChainName;
    toChain = String(toChain || "") as ChainName;
    if (!fromChain || !toChain) throw new Error("Source or destination chain not provided by AI.");
    if (!amountStr) throw new Error("Bridge amount not provided by AI.");
    
    const userAddress = await getAddress();

    // Auto-correct: If one is testnet and the other is mainnet, assume they meant testnet
    if (fromChain.includes('sepolia') && !toChain.includes('sepolia')) {
      if (toChain === 'base') toChain = 'base_sepolia';
      else if (toChain === 'arbitrum') toChain = 'arbitrum_sepolia';
      else if (toChain === 'optimism') toChain = 'optimism_sepolia';
      else if (toChain === 'ethereum') toChain = 'sepolia';
    } else if (toChain.includes('sepolia') && !fromChain.includes('sepolia')) {
      if (fromChain === 'base') fromChain = 'base_sepolia';
      else if (fromChain === 'arbitrum') fromChain = 'arbitrum_sepolia';
      else if (fromChain === 'optimism') fromChain = 'optimism_sepolia';
      else if (fromChain === 'ethereum') fromChain = 'sepolia';
    }
    
    // We assume the same token symbol on both chains for a standard bridge
    const fromTokenAddress = resolveToken(tokenSymbol, fromChain);
    const toTokenAddress = resolveToken(tokenSymbol, toChain);
    
    const amountWei = parseUnits(amountStr, 18).toString(); 
    const slippage = slippagePercent || "auto"; 

    const route = await routeTransaction(
      fromChain, 
      toChain, 
      fromTokenAddress, 
      toTokenAddress, 
      amountWei, 
      userAddress, 
      slippage
    );

    const tx = txManager.createPendingTransaction('bridge', fromChain, {
      fromToken: tokenSymbol,
      toToken: tokenSymbol,
      toChain,
      amount: amountStr,
      fromAddress: fromTokenAddress,
      toAddress: toTokenAddress,
      expectedOutput: route.expectedOutput,
      provider: route.provider,
      gasCostUsd: route.gasCostUsd,
      txData: route.txPayload,
      rawQuote: route.rawQuote
    });

    return `⏳ **Bridge queued:** ${amountStr} ${tokenSymbol} | ${fromChain.toUpperCase()} ➡️ ${toChain.toUpperCase()} | Via ${route.provider} | Approve below.`;
  } catch (error: any) {
    console.error("BRIDGE TOKEN ERROR:", error);
    return `Failed to prepare bridge: ${error.message}`;
  }
}

export const bridgeTokenToolDefinition = {
  type: "function",
  function: {
    name: "bridge_token",
    description: "Prepare a transaction to bridge tokens across blockchains.",
    parameters: {
      type: "object",
      properties: {
        fromChain: { type: "string", enum: SUPPORTED_CHAIN_NAMES },
        toChain: { type: "string", enum: SUPPORTED_CHAIN_NAMES },
        tokenSymbol: { type: "string" },
        amountStr: { type: "string" },
        mode: { type: "string", enum: ["auto", "manual"], default: "auto" },
        providerName: { type: "string", enum: ["auto", "lifi", "relay"], default: "auto" },
        slippagePercent: { type: "number" }
      },
      required: ["fromChain", "toChain", "tokenSymbol", "amountStr"],
    },
  },
};

export async function executeBridge(chainName: string, details: any, autoApprove: boolean = false): Promise<string> {
  const payload = {
    type: 'bridge',
    chainName,
    autoApprove,
    details
  };
  return await submitTransaction(payload);
}
