import { BinancePlugin } from './packages/core/src/web3/plugins/BinancePlugin';

async function test() {
  const binance = new BinancePlugin();
  try {
    const res = await binance.handlers.binance_trading({
      action: 'account',
      marketType: 'FUTURES',
      recvWindow: 5000
    });
    console.log(res);
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}
test();
