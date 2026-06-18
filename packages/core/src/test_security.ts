import { readLocalFile } from './system/skills/readFile';
import { runTerminalCommand } from './system/skills/executeShell';
import { browseWebsite } from './system/skills/browseWeb';
import os from 'os';
import path from 'path';

async function runTests() {
  console.log('=== PENGUJIAN KEAMANAN OS SKILLS ===\n');

  // 1. Tes Directory Blacklist (readFile.ts)
  console.log('--- TES 1: Membaca File Rahasia (readFile) ---');
  const authPath = path.join(os.homedir(), '.nyxora/auth/auth.token');
  const readResult = readLocalFile(authPath);
  console.log('Instruksi LLM : readLocalFile("~/.nyxora/auth/auth.token")');
  console.log('Hasil         : ' + readResult + '\n');

  // 2. Tes Path Traversal
  console.log('--- TES 2: Path Traversal (readFile) ---');
  const traversalPath = path.join(__dirname, '../../../../../.nyxora/config/defi_keys.yaml');
  const traversalResult = readLocalFile(traversalPath);
  console.log('Instruksi LLM : readLocalFile("../../../../../.nyxora/config/defi_keys.yaml")');
  console.log('Hasil         : ' + traversalResult + '\n');

  // 3. Tes Output Redaction Layer (executeShell.ts)
  console.log('--- TES 3: Ekstraksi Rahasia via Terminal (executeShell) ---');
  const shellCmd = `cat ${authPath}`;
  const shellResult = await runTerminalCommand(shellCmd);
  console.log(`Instruksi LLM : runTerminalCommand("${shellCmd}")`);
  console.log('Hasil Terminal:\n' + shellResult);

  // 4. Tes Output Redaction Path (executeShell.ts)
  console.log('--- TES 4: Pencarian Path Rahasia (executeShell) ---');
  const shellCmd2 = `find ${path.join(os.homedir(), '.nyxora')} -type f -name "*.token"`;
  const shellResult2 = await runTerminalCommand(shellCmd2);
  console.log(`Instruksi LLM : runTerminalCommand("${shellCmd2}")`);
  console.log('Hasil Terminal:\n' + shellResult2);

  // 5. Tes SSRF Protection (browseWeb.ts)
  console.log('--- TES 5: Serangan SSRF ke Policy Server (browseWeb) ---');
  const ssrfResult = await browseWebsite('http://127.0.0.1:3001/address');
  console.log('Instruksi LLM : browseWebsite("http://127.0.0.1:3001/address")');
  console.log('Hasil         : ' + ssrfResult + '\n');
}

runTests().catch(console.error);
