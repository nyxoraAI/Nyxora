import { searchDuckDuckGo } from './packages/core/dist/system/skills/searchWeb.js';
async function test() {
  const r = await searchDuckDuckGo("Moto3 2026 official calendar confirmed", 1);
  console.log(r);
}
test();
