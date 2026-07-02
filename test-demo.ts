import { BinancePlugin } from './packages/core/src/web3/plugins/BinancePlugin';
import { TradingJournalPlugin } from './packages/core/src/system/plugins/TradingJournalPlugin';

async function test() {
  const binance = new BinancePlugin();
  
  // Test create_order in demo mode
  const orderRes = await binance.handlers.binance_trading({
    action: 'create_order',
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    price: '90000',
    quantity: '0.001'
  });
  console.log("Create Order Result:", orderRes);
}
test();
