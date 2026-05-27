import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config/parser';
import { getPath } from '../config/paths';
import { ChainName } from '../web3/config';
import { resolveToken } from '../web3/utils/tokens';
import { prepareSwapToken, executeSwap } from '../web3/skills/swapToken';
import { txManager } from './transactionManager';
import { processUserInput } from './reasoning';

export interface LimitOrder {
  id: string;
  chainName: ChainName;
  fromToken: string;
  toToken: string;
  amountStr: string;
  targetPriceUsd: number;
  condition: 'above' | 'below';
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  createdAt: number;
}

export class LimitOrderManager {
  private filePath: string;
  private orders: LimitOrder[] = [];
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor() {
    const config = loadConfig();
    this.filePath = getPath(config.memory?.path ? config.memory.path.replace('memory.json', 'orders.json') : 'orders.json');
    this.loadOrders();
  }

  private loadOrders() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.orders = JSON.parse(data);
      } catch (error) {
        this.orders = [];
      }
    }
  }

  private saveOrders() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.orders, null, 2));
    } catch (error) {}
  }

  public createOrder(chainName: ChainName, fromToken: string, toToken: string, amountStr: string, targetPriceUsd: number, condition: 'above' | 'below'): string {
    const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const order: LimitOrder = {
      id, chainName, fromToken, toToken, amountStr, targetPriceUsd, condition, status: 'pending', createdAt: Date.now()
    };
    this.orders.push(order);
    this.saveOrders();
    return `Limit order created successfully. ID: ${id}. The system will monitor ${fromToken} price on ${chainName} and execute the swap to ${toToken} when price is ${condition} $${targetPriceUsd}.`;
  }

  public listOrders(): string {
    const pending = this.orders.filter(o => o.status === 'pending');
    if (pending.length === 0) return "No active limit orders.";
    let report = "Active Limit Orders:\n";
    pending.forEach(o => {
      report += `- [${o.id}] Swap ${o.amountStr} ${o.fromToken} -> ${o.toToken} on ${o.chainName} when ${o.fromToken} is ${o.condition} $${o.targetPriceUsd}\n`;
    });
    return report;
  }

  public cancelOrder(id: string): string {
    const order = this.orders.find(o => o.id === id);
    if (!order) return `Order ${id} not found.`;
    if (order.status !== 'pending') return `Order ${id} cannot be cancelled because it is ${order.status}.`;
    order.status = 'cancelled';
    this.saveOrders();
    return `Order ${id} cancelled successfully.`;
  }

  public startMonitor() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    // Monitor every 60 seconds
    this.monitorInterval = setInterval(() => this.checkOrders(), 60000);
    console.log('[LimitOrderManager] Order monitoring started (interval: 60s)');
  }

  private async checkOrders() {
    const pending = this.orders.filter(o => o.status === 'pending');
    if (pending.length === 0) return;

    for (const order of pending) {
      try {
        let tokenAddress = resolveToken(order.fromToken, order.chainName);
        if (tokenAddress === "0x0000000000000000000000000000000000000000") {
          tokenAddress = resolveToken("W" + order.fromToken, order.chainName);
        }

        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.pairs || data.pairs.length === 0) continue;

        let pair = data.pairs.find((p: any) => p.chainId === order.chainName) || data.pairs[0];
        const currentPrice = parseFloat(pair.priceUsd);

        let shouldExecute = false;
        if (order.condition === 'above' && currentPrice >= order.targetPriceUsd) shouldExecute = true;
        if (order.condition === 'below' && currentPrice <= order.targetPriceUsd) shouldExecute = true;

        if (shouldExecute) {
          console.log(`[LimitOrderManager] Condition met for order ${order.id}. Current price $${currentPrice} is ${order.condition} $${order.targetPriceUsd}. Executing...`);
          
          // 1. Prepare Swap
          const prepareResult = await prepareSwapToken(order.chainName, order.fromToken, order.toToken, order.amountStr, 'auto');
          
          // 2. Extract Tx ID
          const txMatch = prepareResult.match(/Transaction ID: ([\w-]+)\./);
          if (!txMatch) {
            order.status = 'failed';
            this.saveOrders();
            processUserInput(`Limit order ${order.id} execution failed during preparation. Output: ${prepareResult}`, 'system').catch(() => {});
            continue;
          }

          const txId = txMatch[1];
          const tx = txManager.getTransaction(txId);
          if (!tx) throw new Error("Transaction not found in manager");

          // 3. Execute Swap automatically
          const executeResult = await executeSwap(order.chainName, tx.details);
          
          if (executeResult.includes('successful')) {
            txManager.updateStatus(txId, 'executed', executeResult);
            order.status = 'executed';
            this.saveOrders();
            processUserInput(`Limit order ${order.id} just EXECUTED automatically! Price hit $${currentPrice}. Swap result: ${executeResult}. Please notify the user immediately!`, 'system').catch(() => {});
          } else {
            txManager.updateStatus(txId, 'failed', executeResult);
            order.status = 'failed';
            this.saveOrders();
            processUserInput(`Limit order ${order.id} FAILED to execute. Price hit $${currentPrice} but execution failed: ${executeResult}. Please notify the user.`, 'system').catch(() => {});
          }
        }
      } catch (error: any) {
        console.error(`[LimitOrderManager] Error checking order ${order.id}:`, error.message);
      }
    }
  }
}

export const limitOrderManager = new LimitOrderManager();

export const createLimitOrderToolDefinition = {
  type: "function",
  function: {
    name: "create_limit_order",
    description: "Creates an automatic cut-loss or take-profit limit order. The system will automatically execute the swap when the price condition is met.",
    parameters: {
      type: "object",
      properties: {
        chainName: { type: "string", enum: ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"] },
        fromToken: { type: "string", description: "Token to sell" },
        toToken: { type: "string", description: "Token to buy" },
        amountStr: { type: "string", description: "Amount to sell" },
        targetPriceUsd: { type: "number", description: "Target price in USD for the fromToken" },
        condition: { type: "string", enum: ["above", "below"], description: "Trigger when price goes above (take-profit) or below (cut-loss) target" }
      },
      required: ["chainName", "fromToken", "toToken", "amountStr", "targetPriceUsd", "condition"],
    },
  },
};

export const listLimitOrdersToolDefinition = {
  type: "function",
  function: {
    name: "list_limit_orders",
    description: "Lists all active automated limit orders.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const cancelLimitOrderToolDefinition = {
  type: "function",
  function: {
    name: "cancel_limit_order",
    description: "Cancels an active limit order by ID.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
};
