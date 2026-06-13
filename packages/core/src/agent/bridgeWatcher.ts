import { txManager } from './transactionManager';
import { sendPushNotification } from '../gateway/telegram';
import { loadConfig } from '../config/parser';

// In a real production environment, this would use the @eth-optimism/sdk 
// to fetch the Merkle Proof and call proveWithdrawalTransaction on L1.
// For the scope of this architecture prototype, we simulate the Challenge Period
// watcher by using a time-delay, representing the exact asynchronous behavior.

const CHALLENGE_PERIOD_MS = 2 * 60 * 1000; // Simulating a 2-minute challenge period for testnet demo

export function startBridgeWatcher() {
  console.log('[Bridge Watcher] Started background daemon for asynchronous L2 withdrawals');
  
  setInterval(async () => {
    const config = loadConfig();
    const authId = config.integrations?.telegram?.authorized_chat_id;
    if (!authId) return;

    const pending = txManager.getPendingWithdrawals();
    const now = Date.now();

    for (const w of pending) {
      if (w.status === 'WAITING_FOR_CHALLENGE') {
        if (now - w.createdAt > CHALLENGE_PERIOD_MS) {
          // The simulated challenge period is over. State root is "published".
          console.log(`[Bridge Watcher] Withdrawal ${w.id} is ready for L1 claim!`);
          
          txManager.updateWithdrawalStatus(w.id, 'READY_FOR_CLAIM');
          
          const amountDisplay = Number(w.amount) / 1e18; // assuming 18 decimals
          const message = `🔔 **Bridge Ready to Claim!**\n\nYour withdrawal of ${amountDisplay} ETH from ${w.l2Chain} to ${w.l1Chain} has completed its challenge period.\n\nShall I execute the Prove & Claim transaction on L1 now?`;
          
          await sendPushNotification(authId, message, w.id);
        }
      }
    }
  }, 30000); // Check every 30 seconds
}
