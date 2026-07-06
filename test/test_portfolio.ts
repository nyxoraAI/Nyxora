import { checkPortfolio } from './packages/core/src/web3/skills/checkPortfolio';

async function main() {
  const result = await checkPortfolio('base');
  console.log(result);
}

main().catch(console.error);
