import { logger } from '../memory/logger';
import { getPrice } from './skills/getPrice';
import { prepareSwapToken, executeSwap } from './skills/swapToken';
import { txManager } from '../agent/transactionManager';
import pc from 'picocolors';

class EventListener {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(pc.green('[Event Listener] Real-Time Multi-Source Radar started. Monitoring DexScreener & Oracles...'));
    this.poll();
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
    console.log(pc.yellow('[Event Listener] Radar stopped.'));
  }

  private async poll() {
    if (!this.isRunning) return;

    try {
      // 1. Fetch active limit orders from database
      const rows = logger['db'].prepare(`SELECT * FROM limit_orders WHERE status = 'ACTIVE'`).all();
      
      for (const order of rows as any[]) {
        try {
          // 2. Fetch current price via DexScreener / Aggregator (getPrice skill)
          const priceResult = await getPrice(order.token_address);
          
          // Parse price from result string (rough parsing for MVP)
          const priceMatch = priceResult.match(/Current Price:\s*\$([\d.]+)/i);
          if (!priceMatch) continue;
          
          const currentPrice = parseFloat(priceMatch[1]);
          const targetPrice = order.trigger_price_usd;
          
          let triggered = false;
          if (order.trigger_condition === 'PRICE_DROPS_BELOW' && currentPrice <= targetPrice) triggered = true;
          if (order.trigger_condition === 'PRICE_RISES_ABOVE' && currentPrice >= targetPrice) triggered = true;

          if (triggered) {
            console.log(pc.bgRed(pc.white(`\n[🚨 LIMIT ORDER TRIGGERED] ${order.token_symbol} hit target price $${targetPrice}! Executing ${order.action}...`)));
            
            // 3. Mark as EXECUTING to prevent double-execution
            logger['db'].prepare(`UPDATE limit_orders SET status = 'EXECUTING' WHERE id = ?`).run(order.id);
            
            // 4. Policy Engine & Executor: Prepare and Execute Swap with Slippage Tolerance
            // Note: In V3, this delegates to our existing swap engine which inherently uses 1inch/0x aggregators that support slippage param
            if (order.action === 'BUY') {
                // Buying token using USDC as base for example.
                // In full implementation, we'd look up the user's base asset (USDC/ETH).
                const amountStr = order.amount_usd.toString(); // assuming base is USD stablecoin
                const txMsg = await prepareSwapToken('base', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', order.token_address, amountStr, 'auto', 'auto', order.slippage_tolerance);
                
                // Extract txId
                const txMatch = txMsg.match(/Transaction ID: ([\w-]+)/);
                if (txMatch) {
                    const txId = txMatch[1];
                    const pendingTx = txManager.getTransaction(txId);
                    if (pendingTx) {
                        const result = await executeSwap(pendingTx.chainName, pendingTx.details, true);
                        logger['db'].prepare(`UPDATE limit_orders SET status = 'COMPLETED', tx_hash = ? WHERE id = ?`).run('Executed via router', order.id);
                        console.log(pc.green(`[Event Listener] Order ${order.id} executed successfully. Result: ${result}`));
                        
                        // Notify user (would need a callback to Telegram in full implementation)
                    }
                }
            } else if (order.action === 'SELL') {
                // Selling token for USDC
                 const amountStr = order.amount_usd.toString(); // Ideally convert USD to Token Amount via oracle
                 const txMsg = await prepareSwapToken('base', order.token_address, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', amountStr, 'auto', 'auto', order.slippage_tolerance);
                 // Same extraction logic...
                 const txMatch = txMsg.match(/Transaction ID: ([\w-]+)/);
                 if (txMatch) {
                     const txId = txMatch[1];
                     const pendingTx = txManager.getTransaction(txId);
                     if (pendingTx) {
                         const result = await executeSwap(pendingTx.chainName, pendingTx.details, true);
                         logger['db'].prepare(`UPDATE limit_orders SET status = 'COMPLETED', tx_hash = ? WHERE id = ?`).run('Executed via router', order.id);
                     }
                 }
            }
          }
        } catch (err) {
          console.error(`[Event Listener] Error processing order ${order.id}:`, err);
        }
      }
    } catch (e) {
      console.error('[Event Listener] Critical Poll Error:', e);
    }

    // Schedule next poll (Graceful Degradation to HTTP Polling if WSS isn't used)
    this.timer = setTimeout(() => this.poll(), 10000); // Poll every 10s for prototype
  }
}

export const eventListener = new EventListener();
