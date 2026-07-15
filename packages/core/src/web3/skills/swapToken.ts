import { normalizeChainName } from '../utils/chains';
import { parseUnits, formatUnits } from 'viem';
import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { getAddress, submitTransaction } from '../utils/vaultClient';
import { txManager } from '../../agent/transactionManager';
import { resolveToken } from '../utils/tokens';
import { saveTokenToWhitelist } from '../../utils/userWhitelistManager';
import { routeTransaction } from '../aggregator/defiRouter';
import { logger } from '../../memory/logger';
import { loadConfig } from '../../config/parser';
export async function prepareSwapToken(
  chainName: ChainName, 
  fromToken: string, 
  toToken: string, 
  amountStr: string,
  mode: "auto" | "manual" = "auto",
  providerName: "auto" | "1inch" | "0x" | "lifi" | "relay" | "openocean" | "kyberswap" = "auto",
  slippagePercent?: number | "auto"
): Promise<string> {
  try {
    chainName = normalizeChainName(chainName);
    if (!chainName || !fromToken || !toToken || !amountStr) throw new Error("Missing required parameters for swap (chain, tokens, or amount).");
    const userAddress = await getAddress();
    
    const fromTokenAddress = resolveToken(fromToken, chainName);
    const toTokenAddress = resolveToken(toToken, chainName);
    const isNativeIn = fromTokenAddress === "0x0000000000000000000000000000000000000000" || fromTokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    // Auto-save to Degen Whitelist
    if (!isNativeIn) await saveTokenToWhitelist(userAddress, chainName, fromTokenAddress, 'swap');
    if (toTokenAddress !== "0x0000000000000000000000000000000000000000" && toTokenAddress !== "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      await saveTokenToWhitelist(userAddress, chainName, toTokenAddress, 'swap');
    }

    let decimals = 18;
    if (!isNativeIn) {
      const { getTokenMetadata } = await import('../utils/tokens');
      const { getPublicClient } = await import('../utils/rpcEngine');
      const client = getPublicClient(chainName);
      const meta = await getTokenMetadata(client, fromTokenAddress);
      decimals = meta.decimals;
    }

    let toDecimals = 18;
    const isNativeOut = toTokenAddress === "0x0000000000000000000000000000000000000000" || toTokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    if (!isNativeOut) {
      const { getTokenMetadata } = await import('../utils/tokens');
      const { getPublicClient } = await import('../utils/rpcEngine');
      const client = getPublicClient(chainName);
      const toMeta = await getTokenMetadata(client, toTokenAddress);
      toDecimals = toMeta.decimals;
    }

    const amountWei = parseUnits(amountStr, decimals).toString();

    // --- Pre-flight Balance Check ---
    const { validateTransactionBalances } = await import('../utils/balanceChecker');
    const balanceCheck = await validateTransactionBalances(chainName, userAddress, fromTokenAddress, amountWei);
    if (!balanceCheck.isValid) {
      throw new Error(balanceCheck.message);
    }
    // --------------------------------
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

    const route = await routeTransaction(
      chainName, 
      chainName, 
      fromTokenAddress, 
      toTokenAddress, 
      amountWei,
      amountStr,
      userAddress, 
      slippage,
      providerName // BUG #5 Fix: Pass providerName down to router
    );

    const tx = txManager.createPendingTransaction('swap', chainName, {
      fromToken,
      toToken,
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

    const formattedOutput = formatUnits(route.outputAmount, toDecimals);
    return `⚡ **Transaction Prepared**\nI have found the best route for your swap via **${route.provider}** on the **${chainName.toUpperCase()}** network. Here are the details:\n\n- **Send:** ${amountStr} ${fromToken.toUpperCase()}\n- **Est. Receive:** ${formattedOutput} ${toToken.toUpperCase()}\n- **Est. Gas Fee:** $${route.estimatedGasUsd || '0.00'}\n\n*Is everything correct? Reply **Yes** to execute (will trigger wallet prompt), or **No** to cancel.*`;
  } catch (error: any) {
    return `Failed to prepare swap: ${error.message}`;
  }
}

export async function executeSwap(chainName: string, details: any, autoApprove: boolean = false): Promise<string> {
    chainName = normalizeChainName(chainName);
  const payload = {
    type: 'swap',
    chainName,
    autoApprove,
    details
  };
  return await submitTransaction(payload);
}
export const swapTokenToolDefinition = {
  type: "function",
  function: {
    name: "swap_token",
    description: "Prepare a transaction to swap tokens on a specific blockchain.",
    parameters: {
      type: "object",
      properties: {
        chainName: { type: "string", enum: SUPPORTED_CHAIN_NAMES },
        fromToken: { type: "string" },
        toToken: { type: "string" },
        amountStr: { type: "string", description: "The amount to swap" },
        mode: { type: "string", enum: ["auto", "manual"], default: "auto" },
        providerName: { type: "string", enum: ["auto", "1inch", "0x", "lifi", "relay", "openocean", "kyberswap"], default: "auto", description: "The preferred DEX aggregator or bridge. Use 'auto' to let the system pick the best route." },
        slippagePercent: { type: "number" }
      },
      required: ["chainName", "fromToken", "toToken", "amountStr"],
    },
  },
};
