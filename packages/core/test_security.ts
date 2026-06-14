import { runTerminalCommand } from './src/system/skills/executeShell';

async function runTests() {
  console.log("=== Menguji executeShell.ts ===");
  const safeRes = await runTerminalCommand('echo "Hello World"');
  console.log("Test Safe Command (echo):", safeRes.includes('Hello World') ? "PASSED (Executed)" : `FAILED:\n${safeRes}`);
  
  const unsafeRes = await runTerminalCommand('echo "BEGIN RSA PRIVATE KEY"');
  console.log("Test Secret Redaction:", unsafeRes.includes('[REDACTED_SECRET]') ? "PASSED (Redacted)" : `FAILED:\n${unsafeRes}`);
}

runTests().catch(console.error);
