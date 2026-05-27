import { parseEther, parseUnits } from 'viem';
import { getWalletClient, getPublicClient, ChainName } from '../config';
import { txManager } from '../../agent/transactionManager';
import { resolveToken, ERC20_ABI } from '../utils/tokens';

export async function prepareTransfer(chainName: ChainName, toAddress: `0x${string}`, amountStr: string, token?: string): Promise<string> {
  try {
    const publicClient = getPublicClient(chainName);
    const walletClient = getWalletClient(chainName);
    const account = walletClient.account!;
    
    let tokenAddress = "0x0000000000000000000000000000000000000000";
    let isNative = true;
    let decimals = 18;
    let symbol = "ETH/BNB"; // Generic fallback for native

    if (token) {
      tokenAddress = resolveToken(token, chainName);
      isNative = tokenAddress === "0x0000000000000000000000000000000000000000";
    }

    let gasEstimate: bigint = 0n;

    if (isNative) {
      // Simulate Native Transfer
      const value = parseEther(amountStr);
      gasEstimate = await publicClient.estimateGas({
        account,
        to: toAddress,
        value,
      });
    } else {
      // Simulate ERC-20 Transfer
      decimals = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;

      symbol = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }).catch(() => token || "TOKEN") as string;

      const value = parseUnits(amountStr, decimals);
      
      const { request } = await publicClient.simulateContract({
        account,
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toAddress, value],
      });
      // @ts-ignore
      gasEstimate = request.gas || 50000n; 
    }

    const tx = txManager.createPendingTransaction('transfer', chainName, { 
      toAddress, 
      amountStr, 
      tokenAddress, 
      isNative, 
      decimals,
      gasEstimate: gasEstimate.toString()
    });

    const tokenName = isNative ? "Native Token" : symbol;
    return `TRANSACTION_PENDING: I have prepared the ${tokenName} transfer and simulated it successfully. Estimated gas units: ${gasEstimate}. Transaction ID: ${tx.id}. Wait for user to approve.`;
  } catch (error: any) {
    return `Simulation failed! Cannot prepare transfer. Error: ${error.message}`;
  }
}

export async function executeTransfer(chainName: ChainName, params: any): Promise<string> {
  try {
    const client = getWalletClient(chainName);
    const { toAddress, amountStr, tokenAddress, isNative, decimals } = params;

    let hash;
    if (isNative) {
      hash = await client.sendTransaction({
        account: client.account!,
        chain: client.chain,
        to: toAddress as `0x${string}`,
        value: parseEther(amountStr),
      });
    } else {
      const value = parseUnits(amountStr, decimals);
      // @ts-ignore
      hash = await client.writeContract({
        account: client.account!,
        chain: client.chain,
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toAddress as `0x${string}`, value],
      });
    }

    return `Transaction successful. Hash: ${hash}`;
  } catch (error: any) {
    return `Failed to execute transfer: ${error.message}`;
  }
}

export const transferToolDefinition = {
  type: "function",
  function: {
    name: "transfer_token",
    description: "Transfer native tokens (ETH, BNB, etc.) or ERC-20 tokens from the agent's wallet to a destination address. Automatically performs on-chain simulation before requesting user approval.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
          description: "The name of the blockchain to execute the transfer on."
        },
        toAddress: {
          type: "string",
          description: "The destination 0x... wallet address."
        },
        amountStr: {
          type: "string",
          description: "The amount of tokens to send (e.g. '0.01')."
        },
        token: {
          type: "string",
          description: "Optional. The token symbol (e.g. USDC, USDT) or contract address (0x...). If omitted, sends the native coin."
        }
      },
      required: ["chainName", "toAddress", "amountStr"]
    }
  }
};
