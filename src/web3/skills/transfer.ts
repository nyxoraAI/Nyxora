import { parseEther } from 'viem';
import { getWalletClient, ChainName } from '../config';
import { txManager } from '../../agent/transactionManager';

export async function transferNative(chainName: ChainName, toAddress: `0x${string}`, amountEth: string): Promise<string> {
  const tx = txManager.createPendingTransaction('transfer', chainName, { toAddress, amountEth });
  return `TRANSACTION_PENDING: I have prepared the transfer. Transaction ID: ${tx.id}. Wait for user to approve.`;
}

export async function executeTransfer(chainName: ChainName, toAddress: `0x${string}`, amountEth: string): Promise<string> {
  try {
    const client = getWalletClient(chainName);
    const hash = await client.sendTransaction({
      account: client.account!,
      chain: client.chain,
      to: toAddress,
      value: parseEther(amountEth),
    });
    return `Transaction successful. Hash: ${hash}`;
  } catch (error: any) {
    return `Failed to transfer: ${error.message}`;
  }
}

export const transferToolDefinition = {
  type: "function",
  function: {
    name: "transfer_native",
    description: "Transfer native tokens (ETH, BNB, etc.) from the agent's wallet to a destination address.",
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
        amountEth: {
          type: "string",
          description: "The amount of tokens to send in ETH units (e.g. '0.01')."
        }
      },
      required: ["chainName", "toAddress", "amountEth"]
    }
  }
};
