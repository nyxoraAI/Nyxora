import { loadMarketKeys } from './packages/core/src/config/marketConfigManager.js';
import { safeFetchJson } from './packages/core/src/utils/httpClient.js';
async function test() {
  const keys = loadMarketKeys();
  const res = await safeFetchJson(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?slug=ethereum&convert=IDR`, {
    headers: { 'X-CMC_PRO_API_KEY': keys.cmc_key }
  });
  console.log(JSON.stringify(res.data, null, 2));
}
test().catch(console.error);
