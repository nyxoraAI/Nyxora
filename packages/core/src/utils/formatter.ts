import { PendingTransaction } from '../agent/transactionManager';

export function formatTransactionSuccess(tx: PendingTransaction, rawResult: string): string {
  let txHash = 'N/A';
  
  try {
    const parsed = JSON.parse(rawResult);
    if (parsed.txHash) txHash = parsed.txHash;
    else if (parsed.hash) txHash = parsed.hash;
  } catch (e) {
    if (rawResult.startsWith('0x') && rawResult.length >= 40) {
      txHash = rawResult.trim();
    } else {
      const hashMatch = rawResult.match(/Hash: (0x[a-fA-F0-9]+)/);
      if (hashMatch) {
        txHash = hashMatch[1];
      }
    }
  }

  const formatChain = (c: string) => {
    if (!c) return '';
    return c.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const chainFormatted = formatChain(tx.chainName);

  let actionText = '';
  if (tx.type === 'swap') {
    actionText = `Swapped ${tx.details.amountStr || tx.details.amount} ${tx.details.fromToken.toUpperCase()} to ${tx.details.toToken.toUpperCase()}`;
  } else if (tx.type === 'transfer') {
    actionText = `Transferred ${tx.details.amountStr || tx.details.amountEth} tokens to \`${tx.details.toAddress.slice(0, 6)}...${tx.details.toAddress.slice(-4)}\``;
  } else if (tx.type === 'bridge') {
    actionText = `Bridged tokens to ${formatChain(tx.details.toChain)}`;
  } else if (tx.type === 'approve') {
    actionText = `Approved token access`;
  } else if (tx.type === 'revokeApproval') {
    actionText = `Revoked token access`;
  } else if (tx.type === 'aaveSupply') {
    actionText = `Deposited to Aave V3`;
  } else if (tx.type === 'vaultDeposit') {
    actionText = `Deposited to Yield Vault`;
  } else if (tx.type === 'mint') {
    actionText = `Minted NFT`;
  } else if (tx.type === 'univ3Mint') {
    actionText = `Uniswap Liquidity Provided`;
  } else {
    actionText = 'Action Successful';
  }

  // Format hash to be cleaner (0x1234...abcd)
  const shortHash = txHash.length > 20 && txHash.startsWith('0x') ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}` : txHash;

  return `🌐 **Network:** ${chainFormatted}\n🎯 **Action:** ${actionText}\n📝 **Tx Hash:** \`${shortHash}\``;
}

export function formatTransactionError(tx: PendingTransaction, errorMsg: string): string {
  const formatChain = (c: string) => c.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const chainFormatted = formatChain(tx.chainName);
  return `❌ **Transaction Failed (${chainFormatted})**\n\n🚨 Error: ${errorMsg}`;
}
