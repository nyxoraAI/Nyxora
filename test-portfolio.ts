import { checkPortfolio } from './packages/core/src/web3/skills/checkPortfolio';

async function test() {
  console.time('Total Portfolio Time');
  console.time('Portfolio Base');
  await checkPortfolio('base', '0xD53E3D76cC11e4A91591deF1fe64616E156A7d7E');
  console.timeEnd('Portfolio Base');
  
  console.time('Portfolio BSC');
  await checkPortfolio('bsc', '0xD53E3D76cC11e4A91591deF1fe64616E156A7d7E');
  console.timeEnd('Portfolio BSC');
  console.timeEnd('Total Portfolio Time');
}
test();
