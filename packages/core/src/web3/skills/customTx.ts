import { parseEther } from 'viem';
import { getPublicClient, getAddress, ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
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
    const userAddress = await getAddress();
    const account = userAddress as `0x${string}`;
    
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

export async function executeCustomTx(chainName: ChainName, params: any, autoApprove: boolean = false): Promise<string> {
  try {
    const { toAddress, dataHex, valueWei, gasEstimate } = params;
    const token = process.env.INTERNAL_AUTH_TOKEN;

    const payload: any = {
      type: 'custom',
      chainName,
      autoApprove,
      details: {
        toAddress, dataHex, valueWei, gasEstimate
      }
    };

    if (autoApprove && token) {
      const crypto = require('crypto');
      const signAmount = valueWei || "0";
      payload.internalSignature = crypto.createHmac('sha256', token).update(chainName + signAmount).digest('hex');
    }

    const res = await fetch('http://127.0.0.1:3001/request-tx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error from Policy API');

    if (data.status === 'pending') {
      return `Transaction pending approval via Policy API. Tx ID: ${data.txId}`;
    }

    if (data.signedHash) {
      return `Custom transaction successfully executed on-chain! Transaction Hash: ${data.signedHash}`;
    }
    return `Custom transaction executed. Result: ${JSON.stringify(data)}`;
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
          enum: SUPPORTED_CHAIN_NAMES,
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
