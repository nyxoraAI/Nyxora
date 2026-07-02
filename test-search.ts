import { searchWeb } from './packages/core/src/system/skills/searchWeb';

async function test() {
  console.log("Testing searchWeb...");
  const result = await searchWeb("jadwal motogp 2026", 1);
  console.log("Result:");
  console.log(result);
}

test().catch(console.error);
