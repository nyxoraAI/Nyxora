"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTransactionSuccess = formatTransactionSuccess;
exports.formatTransactionError = formatTransactionError;
function formatTransactionSuccess(tx, rawResult) {
    let txHash = 'N/A';
    try {
        const parsed = JSON.parse(rawResult);
        if (parsed.txHash)
            txHash = parsed.txHash;
    }
    catch (e) {
        const hashMatch = rawResult.match(/Hash: (0x[a-fA-F0-9]+)/);
        if (hashMatch) {
            txHash = hashMatch[1];
        }
    }
    const chainFormatted = tx.chainName.charAt(0).toUpperCase() + tx.chainName.slice(1);
    if (tx.type === 'swap') {
        return `Alright, I have completed the swap from ${tx.details.amount} ${tx.details.fromToken.toUpperCase()} to ${tx.details.toToken.toUpperCase()}.\n\nChain: ${chainFormatted}\nTx Hash:\n${txHash}`;
    }
    else if (tx.type === 'transfer') {
        return `Alright, I have completed the transfer of ${tx.details.amountEth} tokens to ${tx.details.toAddress}.\n\nChain: ${chainFormatted}\nTx Hash:\n${txHash}`;
    }
    return `Transaction successful!\n\nChain: ${chainFormatted}\nTx Hash:\n${txHash}`;
}
function formatTransactionError(tx, errorMsg) {
    const chainFormatted = tx.chainName.charAt(0).toUpperCase() + tx.chainName.slice(1);
    return `❌ Failed to process transaction on ${chainFormatted}.\n\nError: ${errorMsg}`;
}
