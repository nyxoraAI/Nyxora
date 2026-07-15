const { getTxHistory } = require('./dist/web3/skills/getTxHistory.js');

async function test() {
  const address = '0x4e17192c77e9c96748b6c73ec1350798052d9bd2';
  const chains = ['ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'sepolia'];
  
  for (const chain of chains) {
    console.log(`\nTesting chain: ${chain}...`);
    try {
      const result = await getTxHistory(chain, address, 1);
      if (result.startsWith('Error')) {
        console.error(`[ERROR] ${chain}:`, result);
      } else if (result.startsWith('No transactions found')) {
        console.log(`[INFO] ${chain}: No transactions found`);
      } else {
        const parsed = JSON.parse(result);
        console.log(`[SUCCESS] ${chain}: Found ${parsed.length} transactions`);
      }
    } catch (err) {
      console.error(`[EXCEPTION] ${chain}:`, err.message);
    }
  }
}

test();
