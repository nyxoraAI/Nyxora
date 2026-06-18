import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
  private transactions: Map<string, PendingTransaction> = new Map();
  private withdrawals: Map<string, PendingWithdrawal> = new Map();
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), '.nyxora_withdrawals.json');
    this.loadWithdrawals();
  }

  private loadWithdrawals() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(data) as PendingWithdrawal[];
        parsed.forEach(w => this.withdrawals.set(w.id, w));
      } catch (e) {
        console.error("Failed to load withdrawals DB:", e);
      }
    }
  }

  private saveWithdrawals() {
    const data = Array.from(this.withdrawals.values());
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

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

  // --- WITHDRAWAL LOGIC ---
  createPendingWithdrawal(data: Omit<PendingWithdrawal, 'id' | 'status' | 'createdAt'>): PendingWithdrawal {
    const id = crypto.randomUUID();
    const withdrawal: PendingWithdrawal = {
      ...data,
      id,
      status: 'WAITING_FOR_CHALLENGE',
      createdAt: Date.now()
    };
    this.withdrawals.set(id, withdrawal);
    this.saveWithdrawals();
    return withdrawal;
  }

  getPendingWithdrawals(): PendingWithdrawal[] {
    return Array.from(this.withdrawals.values()).filter(w => w.status !== 'COMPLETED');
  }

  updateWithdrawalStatus(id: string, status: WithdrawalStatus) {
    const w = this.withdrawals.get(id);
    if (w) {
      w.status = status;
      this.saveWithdrawals();
    }
  }
}

export const txManager = new TransactionManager();
