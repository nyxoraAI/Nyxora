import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPath } from '../config/paths';
import { logger } from '../memory/logger';

export type TransactionType = 'transfer' | 'swap' | 'bridge' | 'mint' | 'custom' | 'approve' | 'revokeApproval' | 'aaveSupply' | 'vaultDeposit' | 'univ3Mint' | 'limit_order';

export interface PendingTransaction {
  id: string;
  type: TransactionType;
  chainName: string;
  details: any;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  result?: string;
  createdAt: number;
  nonce: string;
}

export type WithdrawalStatus = 'WAITING_FOR_CHALLENGE' | 'READY_FOR_PROVE' | 'WAITING_FOR_FINALIZATION' | 'READY_FOR_CLAIM' | 'COMPLETED';

export interface PendingWithdrawal {
  id: string; // Internal UUID
  l2TxHash: string;
  l1Chain: string;
  l2Chain: string;
  portalAddress: string;
  userAddress: string;
  amount: string;
  status: WithdrawalStatus;
  createdAt: number;
}

class TransactionManager {
  private activePromises: Set<Promise<any>> = new Set();

  constructor() {
    // Migration: if .nyxora_withdrawals.json exists, we could migrate it, but the plan says we can ignore/leave it.
    // However, a simple migration log is fine if we want to be safe.
    try {
      logger.cancelAllPendingTransactions();
      console.log('[TransactionManager] Cleaned up stale pending transactions on startup.');
    } catch (e) {
      console.error('[TransactionManager] Failed to clean up stale transactions:', e);
    }
  }

  // --- PROMISE TRACKING (For Graceful Shutdown) ---
  public trackPromise(promise: Promise<any>) {
    this.activePromises.add(promise);
    promise.finally(() => {
      this.activePromises.delete(promise);
    });
  }

  public async waitForAll(timeoutMs: number = 10000) {
    if (this.activePromises.size === 0) return;
    console.log(`[TransactionManager] Waiting for ${this.activePromises.size} active Web3 transactions to finish...`);
    
    const timeout = new Promise(resolve => setTimeout(resolve, timeoutMs));
    await Promise.race([
      Promise.allSettled(Array.from(this.activePromises)),
      timeout
    ]);
    
    if (this.activePromises.size > 0) {
      console.log(`[TransactionManager] Warning: ${this.activePromises.size} transactions did not finish in time.`);
    } else {
      console.log(`[TransactionManager] All transactions finished cleanly.`);
    }
  }

  // --- TRANSACTIONS (SQLite) ---
  createPendingTransaction(type: TransactionType, chainName: string, details: any): PendingTransaction {
    const id = crypto.randomUUID();
    const nonce = crypto.randomBytes(16).toString('hex');
    const tx: PendingTransaction = {
      id,
      type,
      chainName,
      details,
      status: 'pending',
      createdAt: Date.now(),
      nonce,
    };
    logger.savePendingTransaction(tx);
    return tx;
  }

  getPending(): PendingTransaction[] {
    return logger.getPendingTransactions();
  }

  getTransaction(id: string): PendingTransaction | undefined {
    return logger.getTransaction(id);
  }

  updateStatus(id: string, status: PendingTransaction['status'], result?: string) {
    const tx = logger.getTransaction(id);
    if (tx) {
      tx.status = status;
      if (result) tx.result = result;
      logger.savePendingTransaction(tx);
    }
  }

  // --- WITHDRAWALS (SQLite) ---
  createPendingWithdrawal(data: Omit<PendingWithdrawal, 'id' | 'status' | 'createdAt'>): PendingWithdrawal {
    const id = crypto.randomUUID();
    const withdrawal: PendingWithdrawal = {
      ...data,
      id,
      status: 'WAITING_FOR_CHALLENGE',
      createdAt: Date.now()
    };
    logger.savePendingWithdrawal(withdrawal);
    return withdrawal;
  }

  getPendingWithdrawals(): PendingWithdrawal[] {
    return logger.getPendingWithdrawals();
  }

  updateWithdrawalStatus(id: string, status: WithdrawalStatus) {
    const w = logger.getPendingWithdrawals().find(x => x.id === id);
    if (w) {
      w.status = status;
      logger.savePendingWithdrawal(w);
    }
  }
}

export const txManager = new TransactionManager();
