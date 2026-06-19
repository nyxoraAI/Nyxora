import { describe, it, expect } from 'vitest';
import { formatTransactionSuccess, formatTransactionError } from './formatter';
import { PendingTransaction } from '../agent/transactionManager';

describe('Formatter Utilities', () => {
  it('should format transaction success correctly for swap', () => {
    const tx: PendingTransaction = {
      id: 'test-1',
      type: 'swap',
      chainName: 'ethereum',
      details: {
        fromToken: 'eth',
        toToken: 'usdc',
        amountStr: '1'
      },
      createdAt: Date.now()
    };
    const rawResult = '{"txHash":"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}';
    const output = formatTransactionSuccess(tx, rawResult);
    expect(output).toContain('Network:** Ethereum');
    expect(output).toContain('Action:** Swapped 1 ETH to USDC');
    expect(output).toContain('Tx Hash:** `0x1234...cdef`');
  });

  it('should format transaction error correctly', () => {
    const tx: PendingTransaction = {
      id: 'test-2',
      type: 'bridge',
      chainName: 'base_sepolia',
      details: {},
      createdAt: Date.now()
    };
    const output = formatTransactionError(tx, 'Insufficient funds');
    expect(output).toContain('Transaction Failed (Base Sepolia)');
    expect(output).toContain('Error: Insufficient funds');
  });
});
