export const swapTokenToolDefinition = {
  type: "function",
  function: {
    name: "swap_token",
    description: "Executes a decentralized token swap (DEX) to exchange one cryptocurrency for another.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          description: "The blockchain network (e.g., 'ethereum', 'base', 'arbitrum', 'sepolia')",
        },
        fromToken: {
          type: "string",
          description: "The token symbol to sell/swap from (e.g., 'ETH', 'USDC')",
        },
        toToken: {
          type: "string",
          description: "The token symbol to buy/swap to (e.g., 'USDC', 'UNI')",
        },
        amount: {
          type: "number",
          description: "The amount of fromToken to swap",
        },
      },
      required: ["chainName", "fromToken", "toToken", "amount"],
    },
  },
};

import { txManager } from '../../agent/transactionManager';

export async function swapToken(chainName: string, fromToken: string, toToken: string, amount: number): Promise<string> {
  const tx = txManager.createPendingTransaction('swap', chainName, { fromToken, toToken, amount });
  return `TRANSACTION_PENDING: I have prepared the token swap. Transaction ID: ${tx.id}. Wait for user to approve.`;
}

export async function executeSwap(chainName: string, fromToken: string, toToken: string, amount: number): Promise<string> {
  try {
    // Generate simulated exchange rate for testnet/demo purposes
    let rate = 1.0;
    
    // Simple mock rates based on common pairs
    if (fromToken.toUpperCase() === 'ETH' && toToken.toUpperCase() === 'USDC') rate = 3200;
    if (fromToken.toUpperCase() === 'USDC' && toToken.toUpperCase() === 'ETH') rate = 1 / 3200;
    if (fromToken.toUpperCase() === 'ETH' && toToken.toUpperCase() === 'LINK') rate = 200;
    if (fromToken.toUpperCase() === 'SOL' && toToken.toUpperCase() === 'USDC') rate = 150;
    
    // Add a slight random variance (±1%) to simulate live market slippage
    const variance = 1 + (Math.random() * 0.02 - 0.01);
    const finalRate = rate * variance;
    const toAmount = amount * finalRate;
    
    // Simulate transaction execution delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Generate mock transaction hash
    const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const swapResult = {
      chain: chainName,
      fromToken: fromToken.toUpperCase(),
      toToken: toToken.toUpperCase(),
      fromAmount: amount.toFixed(4),
      toAmount: toAmount.toFixed(4),
      exchangeRate: finalRate.toFixed(6),
      gasFee: (Math.random() * 0.005).toFixed(4) + ' ETH',
      txHash: txHash,
      status: 'SUCCESS'
    };

    return JSON.stringify(swapResult);
  } catch (error: any) {
    return JSON.stringify({ error: `Failed to execute swap: ${error.message}` });
  }
}
