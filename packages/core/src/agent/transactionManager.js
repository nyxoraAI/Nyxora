"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.txManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
class TransactionManager {
    transactions = new Map();
    createPendingTransaction(type, chainName, details) {
        const id = crypto_1.default.randomUUID();
        const tx = {
            id,
            type,
            chainName,
            details,
            status: 'pending',
            createdAt: Date.now(),
        };
        this.transactions.set(id, tx);
        return tx;
    }
    getPending() {
        return Array.from(this.transactions.values()).filter(t => t.status === 'pending');
    }
    getTransaction(id) {
        return this.transactions.get(id);
    }
    updateStatus(id, status, result) {
        const tx = this.transactions.get(id);
        if (tx) {
            tx.status = status;
            if (result)
                tx.result = result;
        }
    }
}
exports.txManager = new TransactionManager();
