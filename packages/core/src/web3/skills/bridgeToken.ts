import { parseUnits, formatUnits } from 'viem';
import { ChainName, SUPPORTED_CHAIN_NAMES, normalizeChainName } from '../config';
import { getAddress, submitTransaction } from '../utils/vaultClient';
import { txManager } from '../../agent/transactionManager';
import { resolveToken } from '../utils/tokens';
import { routeTransaction } from '../aggregator/defiRouter';
import { logger } from '../../memory/logger';
import { loadConfig } from '../../config/parser';
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
    fromChain = normalizeChainName(fromChain);
    toChain = normalizeChainName(toChain);
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
    
    const isNativeIn = fromTokenAddress === "0x0000000000000000000000000000000000000000" || fromTokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    
    // Fetch actual token decimals on-chain to prevent overflow (BUG #1 Fix)
    let decimals = 18;
    if (!isNativeIn) {
      const { getTokenMetadata } = await import('../utils/tokens');
      const { getPublicClient } = await import('../utils/rpcEngine');
      const client = getPublicClient(fromChain);
      const meta = await getTokenMetadata(client, fromTokenAddress);
      decimals = meta.decimals;
    }

    const amountWei = parseUnits(amountStr, decimals).toString(); 
    
    // Front-to-Back Slippage Architecture
    const userProfile = logger.getUserProfile();
    const maxSlippage = userProfile?.max_slippage || 1.0;
    const config = loadConfig();
    const cfgSlippage = (config.agent as any)?.default_slippage;
    
    let finalSlippage = slippagePercent;
    if (finalSlippage === undefined || finalSlippage === null || finalSlippage === "auto") {
        finalSlippage = (cfgSlippage === "auto" || !cfgSlippage) ? 0.5 : parseFloat(cfgSlippage as string);
    }
    
    if (typeof finalSlippage !== 'number' || isNaN(finalSlippage)) finalSlippage = 0.5;
    if (finalSlippage > maxSlippage) finalSlippage = maxSlippage;
    const slippage = finalSlippage;
    // --- Pre-flight Balance Check ---
    const { validateTransactionBalances } = await import('../utils/balanceChecker');
    const balanceCheck = await validateTransactionBalances(fromChain, userAddress, fromTokenAddress, amountWei);
    if (!balanceCheck.isValid) {
      throw new Error(balanceCheck.message);
    }
    // --------------------------------


    const route = await routeTransaction(
      fromChain, 
      toChain, 
      fromTokenAddress, 
      toTokenAddress, 
      amountWei,
      amountStr,
      userAddress, 
      slippage,
      providerName
    );

    const tx = txManager.createPendingTransaction('bridge', fromChain, {
      fromToken: tokenSymbol,
      toToken: tokenSymbol,
      toChain,
      amount: amountStr,
      fromAddress: fromTokenAddress,
      toAddress: toTokenAddress,
      expectedOutput: route.outputAmount.toString(),
      provider: route.provider,
      gasCostUsd: route.estimatedGasUsd || 0,
      txData: route.execution,
      rawQuote: route.raw,
      expiresAt: route.expiresAt
    });

    const formattedOutput = formatUnits(route.outputAmount, decimals);
    return `⚡ **Bridge Transaction Prepared**\nI have prepared a route to bridge your tokens via **${route.provider}**. Here are the details:\n\n- **From:** ${amountStr} ${tokenSymbol.toUpperCase()} on **${fromChain.toUpperCase()}**\n- **Est. Receive:** ${formattedOutput} ${tokenSymbol.toUpperCase()} on **${toChain.toUpperCase()}**\n- **Est. Gas Fee:** $${route.estimatedGasUsd || '0.00'}\n\n*Is everything correct? Reply **Yes** to execute (will trigger wallet prompt), or **No** to cancel.*`;
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
        providerName: { type: "string", enum: ["auto", "lifi", "relay", "op_bridge_testnet", "arbitrum_bridge_testnet"], default: "auto", description: "The preferred provider. Use 'op_bridge_testnet' (for OP/Base Sepolia), 'arbitrum_bridge_testnet' (for Arb Sepolia or Robinhood Testnet), or 'relay' (testnet fallback)." },
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
