import { BinancePlugin } from './packages/core/src/web3/plugins/BinancePlugin';
import { TradingJournalPlugin } from './packages/core/src/system/plugins/TradingJournalPlugin';

async function test() {
  console.log("=== Testing BinancePlugin ===");
  const binance = new BinancePlugin();
  const res1 = await binance.handlers.binance_trading({ action: 'ping' });
  console.log("Ping:", res1);
  
  console.log("\n=== Testing TradingJournalPlugin ===");
  const journal = new TradingJournalPlugin();
  const res2 = await journal.handlers.trading_journal({ action: 'get_daily_pnl' });
  console.log("Journal PnL:", res2);
}
test();
