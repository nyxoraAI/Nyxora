import { parseUnits } from 'viem';
import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { getAddress, submitTransaction } from '../utils/vaultClient';
import { txManager } from '../../agent/transactionManager';
import { resolveToken } from '../utils/tokens';
import { saveTokenToWhitelist } from '../../utils/userWhitelistManager';
import { routeTransaction } from '../aggregator/defiRouter';

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
    const userAddress = await getAddress();
    
    const fromTokenAddress = resolveToken(fromToken, chainName);
    const toTokenAddress = resolveToken(toToken, chainName);
    const isNativeIn = fromTokenAddress === "0x0000000000000000000000000000000000000000";

    // Auto-save to Degen Whitelist
    if (!isNativeIn) saveTokenToWhitelist(userAddress, chainName, fromTokenAddress, 'swap');
    if (toTokenAddress !== "0x0000000000000000000000000000000000000000") {
      saveTokenToWhitelist(userAddress, chainName, toTokenAddress, 'swap');
    }

    // Default to 18 decimals for formatting input, though Aggregator handles this if we pass raw
    const amountWei = parseUnits(amountStr, 18).toString(); 

    const slippage = slippagePercent || "auto";

    const route = await routeTransaction(
      chainName, 
      chainName, 
      fromTokenAddress, 
      toTokenAddress, 
      amountWei, 
      userAddress, 
      slippage
    );

    const tx = txManager.createPendingTransaction('swap', chainName, {
      fromToken,
      toToken,
      amount: amountStr,
      fromAddress: fromTokenAddress,
      toAddress: toTokenAddress,
      expectedOutput: route.expectedOutput,
      provider: route.provider,
      gasCostUsd: route.gasCostUsd,
      txData: route.txPayload,
      rawQuote: route.rawQuote
    });

    return `TRANSACTION_PENDING\nSwap transaction of ${amountStr} ${fromToken} to ${toToken} on ${chainName.toUpperCase()} via ${route.provider} has been queued. Expected output: ${route.expectedOutput} ${toToken}.\nTransaction ID: ${tx.id}\nPlease review and approve this transaction in your dashboard UI.`;
  } catch (error: any) {
    return `Failed to prepare swap: ${error.message}`;
  }
}

export async function executeSwap(chainName: string, details: any, autoApprove: boolean = false): Promise<string> {
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
        providerName: { type: "string", enum: ["auto", "1inch", "0x", "lifi", "relay", "openocean", "kyberswap"], default: "auto" },
        slippagePercent: { type: "number" }
      },
      required: ["chainName", "fromToken", "toToken", "amountStr"],
    },
  },
};
