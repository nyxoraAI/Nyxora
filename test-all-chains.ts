import { checkPortfolio } from './packages/core/src/web3/skills/checkPortfolio';
import fs from 'fs';
async function test() {
  process.env.INTERNAL_AUTH_TOKEN = fs.readFileSync('/home/perasyudha/.nyxora/runtime.token', 'utf8');
  const chains = ["ethereum", "base", "bsc", "arbitrum", "optimism", "sepolia"];
  for (const chain of chains) {
    console.time(chain);
    try {
      await Promise.race([
        checkPortfolio(chain as any),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
      ]);
      console.timeEnd(chain);
    } catch(e: any) {
      console.log(`Failed ${chain}: ${e.message}`);
    }
  }
}
test();
