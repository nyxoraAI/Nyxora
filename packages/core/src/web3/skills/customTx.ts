import { normalizeChainName } from '../utils/chains';
import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { txManager } from '../../agent/transactionManager';
import { submitTransaction } from '../utils/vaultClient';

export async function prepareCustomTx(
  chainName: ChainName, 
  toAddress: string, 
  data: string, 
  valueWei: string = "0",
  description: string = "Custom transaction"
): Promise<string> {
  try {
    chainName = normalizeChainName(chainName);
    if (!chainName || !toAddress || !data) throw new Error("Missing required parameters for custom transaction.");
    const { getAddress } = await import('../utils/vaultClient');
    const userAddress = await getAddress();

    // --- Pre-flight Balance Check ---
    // Custom Tx uses native coin as value Wei.
    const { validateTransactionBalances } = await import('../utils/balanceChecker');
    const balanceCheck = await validateTransactionBalances(chainName, userAddress, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", valueWei);
    if (!balanceCheck.isValid) {
      throw new Error(balanceCheck.message);
    }
    // --------------------------------

    const tx = txManager.createPendingTransaction('custom', chainName, {
      toAddress,
      data,
      valueWei,
      description
    });

    return `⏳ **Custom Tx queued:** ${description} | ${chainName.toUpperCase()} | Please reply with 'Yes' to execute, or 'No' to cancel.`;
  } catch (error: any) {
    return `Failed to prepare custom tx: ${error.message}`;
  }
}

export const customTxToolDefinition = {
  type: "function",
  function: {
    name: "custom_tx",
    description: "Prepare a custom smart contract transaction by specifying exact calldata.",
    parameters: {
      type: "object",
      properties: {
        chainName: { type: "string", enum: SUPPORTED_CHAIN_NAMES },
        toAddress: { type: "string", description: "Target contract address" },
        data: { type: "string", description: "Hex encoded calldata (0x...)" },
        valueWei: { type: "string", description: "Amount of native token to send in Wei" },
        description: { type: "string", description: "Human readable description of what this does" }
      },
      required: ["chainName", "toAddress", "data"],
    },
  },
};

export async function executeCustomTx(chainName: string, details: any, autoApprove: boolean = false): Promise<string> {
    chainName = normalizeChainName(chainName);
  // Fix HMAC mismatch by guaranteeing amountWei exists to match valueWei 
  const processedDetails = {
    ...details,
    amountWei: details.amountWei || details.valueWei || "0"
  };

  const payload = {
    type: 'custom',
    chainName,
    autoApprove,
    details: processedDetails
  };
  return await submitTransaction(payload);
}
