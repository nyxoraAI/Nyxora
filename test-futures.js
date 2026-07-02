const path = require('path');
require('dotenv').config({ path: '/home/perasyudha/.nyxora/skills/binance_trading/.env' });

const { execute } = require('/home/perasyudha/.nyxora/skills/binance_trading/scripts/execute.js');

async function test() {
  const res = await execute({
    action: 'account',
    marketType: 'FUTURES'
  });
  console.log(res);
}
test();
