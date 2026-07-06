import { getTxHistory } from './src/web3/skills/getTxHistory';

async function test() {
  const address = '0x4e17192c77e9c96748b6c73ec1350798052d9bd2'; // from the user's message
  const chains = ['ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'sepolia'];
  
  for (const chain of chains) {
    console.log(`\nTesting chain: ${chain}...`);
    try {
      const result = await getTxHistory(chain as any, address, 1);
      if (result.startsWith('Error')) {
        console.error(`[ERROR] ${chain}:`, result);
      } else if (result.startsWith('No transactions found')) {
        console.log(`[INFO] ${chain}: No transactions found (Expected for inactive chains)`);
      } else {
        const parsed = JSON.parse(result);
        console.log(`[SUCCESS] ${chain}: Found ${parsed.length} transactions`);
      }
    } catch (err: any) {
      console.error(`[EXCEPTION] ${chain}:`, err.message);
    }
  }
}

test();
