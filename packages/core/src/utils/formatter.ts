import { PendingTransaction } from '../agent/transactionManager';

export function formatTransactionSuccess(tx: PendingTransaction, rawResult: string, isIndonesian: boolean = false): string {
  let txHash = 'N/A';
  
  try {
    const parsed = JSON.parse(rawResult);
    if (parsed.txHash) txHash = parsed.txHash;
  } catch (e) {
    const hashMatch = rawResult.match(/Hash: (0x[a-fA-F0-9]+)/);
    if (hashMatch) {
      txHash = hashMatch[1];
    }
  }

  const chainFormatted = tx.chainName.charAt(0).toUpperCase() + tx.chainName.slice(1);

  let actionText = '';
  if (tx.type === 'swap') {
    actionText = isIndonesian ? `Swap ${tx.details.amount} ${tx.details.fromToken.toUpperCase()} ke ${tx.details.toToken.toUpperCase()}` : `Swapped ${tx.details.amount} ${tx.details.fromToken.toUpperCase()} to ${tx.details.toToken.toUpperCase()}`;
  } else if (tx.type === 'transfer') {
    actionText = isIndonesian ? `Transfer ${tx.details.amountEth} token ke <code>${tx.details.toAddress}</code>` : `Transferred ${tx.details.amountEth} tokens to <code>${tx.details.toAddress}</code>`;
  } else {
    actionText = isIndonesian ? 'Aksi Berhasil' : 'Action Successful';
  }

  if (isIndonesian) {
    return `**Nama Chain:** ${chainFormatted}\n**Status:** Sukses (${actionText})\n**Tx Hash:** <code>${txHash}</code>`;
  } else {
    return `**Chain Name:** ${chainFormatted}\n**Status:** Success (${actionText})\n**Tx Hash:** <code>${txHash}</code>`;
  }
}

export function formatTransactionError(tx: PendingTransaction, errorMsg: string): string {
  const chainFormatted = tx.chainName.charAt(0).toUpperCase() + tx.chainName.slice(1);
  return `❌ Failed to process transaction on ${chainFormatted}.\n\nError: ${errorMsg}`;
}
