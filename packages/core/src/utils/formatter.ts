import { PendingTransaction } from '../agent/transactionManager';

export function formatTransactionSuccess(tx: PendingTransaction, rawResult: string, isIndonesian: boolean = false): string {
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
    actionText = isIndonesian ? `Swap ${tx.details.amountStr || tx.details.amount} ${tx.details.fromToken.toUpperCase()} ke ${tx.details.toToken.toUpperCase()}` : `Swapped ${tx.details.amountStr || tx.details.amount} ${tx.details.fromToken.toUpperCase()} to ${tx.details.toToken.toUpperCase()}`;
  } else if (tx.type === 'transfer') {
    actionText = isIndonesian ? `Transfer ${tx.details.amountStr || tx.details.amountEth} token ke \`${tx.details.toAddress.slice(0, 6)}...${tx.details.toAddress.slice(-4)}\`` : `Transferred ${tx.details.amountStr || tx.details.amountEth} tokens to \`${tx.details.toAddress.slice(0, 6)}...${tx.details.toAddress.slice(-4)}\``;
  } else if (tx.type === 'bridge') {
    actionText = isIndonesian ? `Bridge token ke ${formatChain(tx.details.toChain)}` : `Bridged tokens to ${formatChain(tx.details.toChain)}`;
  } else if (tx.type === 'approve') {
    actionText = isIndonesian ? `Approve akses token` : `Approved token access`;
  } else if (tx.type === 'revokeApproval') {
    actionText = isIndonesian ? `Cabut akses token (Revoke)` : `Revoked token access`;
  } else if (tx.type === 'aaveSupply') {
    actionText = isIndonesian ? `Deposit ke Aave V3` : `Deposited to Aave V3`;
  } else if (tx.type === 'vaultDeposit') {
    actionText = isIndonesian ? `Deposit ke Yield Vault` : `Deposited to Yield Vault`;
  } else if (tx.type === 'mint') {
    actionText = isIndonesian ? `Mint NFT` : `Minted NFT`;
  } else if (tx.type === 'univ3Mint') {
    actionText = isIndonesian ? `Penyediaan Likuiditas Uniswap` : `Uniswap Liquidity Provided`;
  } else {
    actionText = isIndonesian ? 'Aksi Berhasil' : 'Action Successful';
  }

  // Format hash to be cleaner (0x1234...abcd)
  const shortHash = txHash.length > 20 && txHash.startsWith('0x') ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}` : txHash;

  if (isIndonesian) {
    return `🌐 **Jaringan:** ${chainFormatted}\n🎯 **Aksi:** ${actionText}\n📝 **Tx Hash:** \`${shortHash}\``;
  } else {
    return `🌐 **Network:** ${chainFormatted}\n🎯 **Action:** ${actionText}\n📝 **Tx Hash:** \`${shortHash}\``;
  }
}

export function formatTransactionError(tx: PendingTransaction, errorMsg: string): string {
  const formatChain = (c: string) => c.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const chainFormatted = formatChain(tx.chainName);
  return `❌ **Transaksi Gagal (${chainFormatted})**\n\n🚨 Kesalahan: ${errorMsg}`;
}
