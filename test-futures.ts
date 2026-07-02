import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/home/perasyudha/.nyxora/skills/binance_trading/.env' });

import { execute } from '/home/perasyudha/.nyxora/skills/binance_trading/scripts/execute';

async function test() {
  const res = await execute({
    action: 'account',
    marketType: 'FUTURES'
  } as any);
  console.log(res);
}
test();
