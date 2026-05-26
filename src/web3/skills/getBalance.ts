import { formatEther } from 'viem';
import { getPublicClient, ChainName } from '../config';

export async function getBalance(chainName: ChainName, address?: `0x${string}`): Promise<string> {
  try {
    const client = getPublicClient(chainName);
    
    let targetAddress = address;
    if (!targetAddress) {
      const { getAddress } = await import('../config');
      targetAddress = getAddress();
    }

    if (!targetAddress) {
      throw new Error('Address is required but could not be resolved from private key.');
    }

    const balanceWei = await client.getBalance({ address: targetAddress as `0x${string}` });
    const balanceEth = formatEther(balanceWei);
    
    return `${balanceEth} on ${chainName}`;
  } catch (error: any) {
    return `Failed to get balance: ${error.message}`;
  }
}

export const getBalanceToolDefinition = {
  type: "function",
  function: {
    name: "get_balance",
    description: "Get the native token balance (ETH, BNB, etc) of a wallet address on a specific chain. If address is omitted, it returns the balance of the agent's own wallet.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
          description: "The name of the blockchain to check."
        },
        address: {
          type: "string",
          description: "Optional. The 0x... address of the wallet. If not provided, it uses the agent's wallet."
        }
      },
      required: ["chainName"]
    }
  }
};
