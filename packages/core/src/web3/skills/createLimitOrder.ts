import { normalizeChainName } from '../utils/chains';
import { logger } from '../../memory/logger';
import { txManager } from '../../agent/transactionManager';
import { loadConfig } from '../../config/parser';
export async function createLimitOrder(
  tokenSymbol: string,
  tokenAddress: string,
  triggerCondition: 'PRICE_DROPS_BELOW' | 'PRICE_RISES_ABOVE',
  triggerPriceUsd: number,
  action: 'BUY' | 'SELL',
  amountUsd: number,
  slippageTolerance?: number
): Promise<string> {
  try {
    // Front-to-Back Slippage Architecture
    const userProfile = logger.getUserProfile();
    const maxSlippage = userProfile?.max_slippage || 1.0;
    const config = loadConfig();
    const cfgSlippage = (config.agent as any)?.default_slippage;
    
    let finalSlippage = slippageTolerance;
    if (finalSlippage === undefined || finalSlippage === null) {
        finalSlippage = (cfgSlippage === "auto" || !cfgSlippage) ? 0.5 : parseFloat(cfgSlippage as string);
    }
    
    if (typeof finalSlippage !== 'number' || isNaN(finalSlippage)) finalSlippage = 0.5;
    if (finalSlippage > maxSlippage) finalSlippage = maxSlippage;
    
    const orderData = {
      token_symbol: tokenSymbol,
      token_address: tokenAddress,
      trigger_condition: triggerCondition,
      trigger_price_usd: triggerPriceUsd,
      action,
      amount_usd: amountUsd,
      slippage_tolerance: finalSlippage
    };

    const orderId = logger.createLimitOrder(orderData);
    
    const tx = txManager.createPendingTransaction('limit_order', 'any', {
      orderId,
      ...orderData
    });

    return `[UNSAFE/HIGH RISK ALERT] Limit Order drafted successfully.\nTrigger: If ${tokenSymbol} ${triggerCondition === 'PRICE_DROPS_BELOW' ? 'drops below' : 'rises above'} $${triggerPriceUsd}, ${action} $${amountUsd} worth of ${tokenSymbol}.\nTransaction ID: ${tx.id}\nStatus: PENDING_APPROVAL. Waiting for your explicit confirmation via UI/Telegram before the Event-Driven Engine activates.`;
  } catch (error: any) {
    return `Failed to create Limit Order: ${error.message}`;
  }
}

export const createLimitOrderToolDefinition = {
  type: "function",
  function: {
    name: "create_limit_order",
    description: "[HIGH RISK] Create a decentralized limit order (trigger) that will automatically execute a trade when a token's price hits a specific target. Use this when the user asks to buy or sell a token if the price goes up or down to a certain level.",
    parameters: {
      type: "object",
      properties: {
        tokenSymbol: { type: "string", description: "Symbol of the token (e.g. PEPE, ETH)" },
        tokenAddress: { type: "string", description: "Contract address of the token" },
        triggerCondition: { type: "string", enum: ["PRICE_DROPS_BELOW", "PRICE_RISES_ABOVE"], description: "The condition to trigger the order" },
        triggerPriceUsd: { type: "number", description: "The target price in USD" },
        action: { type: "string", enum: ["BUY", "SELL"], description: "The action to take when triggered" },
        amountUsd: { type: "number", description: "The amount in USD to buy or sell" },
        slippageTolerance: { type: "number", description: "Maximum slippage tolerance in percentage (e.g. 5.0)" }
      },
      required: ["tokenSymbol", "tokenAddress", "triggerCondition", "triggerPriceUsd", "action", "amountUsd"],
    },
  },
};
