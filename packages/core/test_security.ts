import { runTerminalCommand } from './src/system/skills/executeShell';
import { installExternalSkill } from './src/system/skills/installSkill';

import fs from 'fs';
import path from 'path';
import { getAppDir } from './src/config/paths';

async function runTests() {
  console.log("=== Menguji executeShell.ts ===");
  const safeRes = await runTerminalCommand('echo "Hello World"');
  console.log("Test Safe Command (echo):", safeRes.includes('Hello World') ? "PASSED (Executed)" : `FAILED:\n${safeRes}`);
  
  const unsafeRes = await runTerminalCommand('rm -rf /tmp/test');
  console.log("Test Unsafe Command (rm):", unsafeRes.includes('ERROR:') && unsafeRes.includes('Command Injection Blocked') ? "PASSED (Blocked)" : `FAILED:\n${unsafeRes}`);


}

runTests().catch(console.error);
