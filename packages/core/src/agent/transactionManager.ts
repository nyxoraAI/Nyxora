import crypto from 'crypto';

export type TransactionType = 'transfer' | 'swap' | 'bridge' | 'mint' | 'custom';

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

class TransactionManager {
  private transactions: Map<string, PendingTransaction> = new Map();

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
    this.transactions.set(id, tx);
    return tx;
  }

  getPending(): PendingTransaction[] {
    return Array.from(this.transactions.values()).filter(t => t.status === 'pending');
  }

  getTransaction(id: string): PendingTransaction | undefined {
    return this.transactions.get(id);
  }

  updateStatus(id: string, status: PendingTransaction['status'], result?: string) {
    const tx = this.transactions.get(id);
    if (tx) {
      tx.status = status;
      if (result) tx.result = result;
    }
  }
}

export const txManager = new TransactionManager();
