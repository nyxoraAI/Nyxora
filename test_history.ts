import { getTxHistory } from './packages/core/src/web3/skills/getTxHistory';
import { ChainName } from './packages/core/src/web3/config';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runFullTest() {
  const chains: ChainName[] = ['ethereum', 'base', 'arbitrum', 'polygon'];
  const vitalikAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const daysToScan = 1;

  console.log(`🚀 Starting Full Integration Test for Etherscan API V2...`);
  console.log(`Target Address: ${vitalikAddress}`);
  console.log(`Fallback API Key: YourApiKeyToken (1 req/5s rate limit applied)\n`);

  for (const chain of chains) {
    try {
      console.log(`⏳ Fetching transactions for [${chain.toUpperCase()}]...`);
      const result = await getTxHistory(chain, vitalikAddress, daysToScan);
      
      if (result.startsWith('Error')) {
        console.error(`❌ [${chain.toUpperCase()}] Failed: ${result}\n`);
      } else if (result.includes('No transactions found')) {
        console.log(`✅ [${chain.toUpperCase()}] Success: No transactions in the last ${daysToScan} days.\n`);
      } else {
        const txArray = JSON.parse(result);
        console.log(`✅ [${chain.toUpperCase()}] Success: Found ${txArray.length} transactions.`);
        console.log(`   Sample Data (Tx 1): ${JSON.stringify(txArray[0])}\n`);
      }
    } catch (e: any) {
      console.error(`❌ [${chain.toUpperCase()}] Exception: ${e.message}\n`);
    }

    // Wait 6 seconds to respect the public API rate limit (1 req / 5 seconds)
    // We are making 2 requests per chain (native + erc20), so actually it might hit rate limit if we don't delay between internal fetch calls.
    // Wait, getTxHistory internally calls fetch twice in parallel without delay! 
    // This might trigger rate limit on Etherscan for public keys!
    await delay(6000); 
  }
}

runFullTest().then(() => console.log('🎉 Full Test Completed.'));
