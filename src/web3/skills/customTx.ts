import { parseEther } from 'viem';
import { getWalletClient, getPublicClient, ChainName } from '../config';
import { txManager } from '../../agent/transactionManager';

export async function prepareCustomTx(
  chainName: ChainName, 
  toAddress: `0x${string}`, 
  dataHex: `0x${string}`,
  valueEth: string = "0",
  gasLimitStr?: string
): Promise<string> {
  try {
    const publicClient = getPublicClient(chainName);
    const walletClient = getWalletClient(chainName);
    const account = walletClient.account!;
    
    if (!dataHex.startsWith("0x")) {
      throw new Error("Data must start with 0x (Hex format)");
    }

    const valueWei = parseEther(valueEth);

    let gasEstimate: bigint = 0n;
    if (gasLimitStr) {
      gasEstimate = BigInt(gasLimitStr);
    } else {
      gasEstimate = await publicClient.estimateGas({
        account,
        to: toAddress,
        data: dataHex,
        value: valueWei,
      });
    }

    const tx = txManager.createPendingTransaction('custom', chainName, { 
      toAddress,
      dataHex,
      valueWei: valueWei.toString(),
      gasEstimate: gasEstimate.toString()
    });

    return `TRANSACTION_PENDING: Simulated Custom Transaction successfully. Estimated gas units: ${gasEstimate}. Transaction ID: ${tx.id}. Wait for user to approve.`;
  } catch (error: any) {
    return `Simulation failed! Cannot prepare custom tx. Error: ${error.message}`;
  }
}

export async function executeCustomTx(chainName: ChainName, params: any): Promise<string> {
  try {
    const client = getWalletClient(chainName);
    const { toAddress, dataHex, valueWei, gasEstimate } = params;

    const hash = await client.sendTransaction({
      account: client.account!,
      chain: client.chain,
      to: toAddress as `0x${string}`,
      data: dataHex as `0x${string}`,
      value: BigInt(valueWei),
      gas: gasEstimate ? BigInt(gasEstimate) * 12n / 10n : undefined, // 20% buffer
    });

    return `Custom transaction successful. Tx Hash: ${hash}`;
  } catch (error: any) {
    return `Failed to execute custom transaction: ${error.message}`;
  }
}

export const customTxToolDefinition = {
  type: "function",
  function: {
    name: "custom_tx",
    description: "Executes a raw custom transaction with calldata (hex) on a specific blockchain network. Automatically simulates the execution.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"],
          description: "The blockchain network",
        },
        toAddress: {
          type: "string",
          description: "The destination contract or wallet address (0x...)",
        },
        dataHex: {
          type: "string",
          description: "The raw calldata payload in hex format (starting with 0x)",
        },
        valueEth: {
          type: "string",
          description: "The amount of native ETH/BNB to attach. Default is '0'.",
        },
        gasLimitStr: {
          type: "string",
          description: "Optional custom gas limit as a string. If omitted, the node will estimate it.",
        }
      },
      required: ["chainName", "toAddress", "dataHex", "valueEth"],
    },
  },
};
