import { getAddress } from './packages/core/src/web3/config';
import fs from 'fs';
import path from 'path';
async function test() {
  process.env.INTERNAL_AUTH_TOKEN = fs.readFileSync('/home/perasyudha/.nyxora/runtime.token', 'utf8');
  console.time('getAddress');
  const address = await getAddress();
  console.timeEnd('getAddress');
  console.log("Address:", address);
}
test();
