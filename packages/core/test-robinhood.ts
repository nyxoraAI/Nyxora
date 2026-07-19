import { checkPortfolio } from './src/web3/skills/checkPortfolio';
(async () => {
  const result = await checkPortfolio('robinhood_testnet', '0x0000000000000000000000000000000000000000');
  console.log("RESULT:", result);
})();
