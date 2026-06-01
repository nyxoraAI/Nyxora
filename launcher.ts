import { initSafeLogger } from './packages/core/src/utils/safeLogger';
initSafeLogger();

import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const INTERNAL_AUTH_TOKEN = crypto.randomBytes(64).toString('hex');
console.log(`[Launcher] Generated Internal Auth Token: ${INTERNAL_AUTH_TOKEN.substring(0, 8)}...`);

const nyxoraDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora');
if (!fs.existsSync(nyxoraDir)) fs.mkdirSync(nyxoraDir, { recursive: true, mode: 0o700 });
const tokenPath = path.join(nyxoraDir, 'runtime.token');
fs.writeFileSync(tokenPath, INTERNAL_AUTH_TOKEN, { mode: 0o600 });
console.log(`[Launcher] Secured runtime token at ${tokenPath} (0600)`);

const env = {
  ...process.env,
  INTERNAL_AUTH_TOKEN,
  SIGNER_SOCKET_PATH: '/tmp/nyxora-signer.sock',
  TS_NODE_CACHE: 'false'
};

const spawnService = (name: string, command: string, args: string[], env: any, inheritStdio: boolean = false) => {
  const child = spawn(command, args, { env, stdio: inheritStdio ? 'inherit' : 'pipe' });

  if (!inheritStdio) {
    child.stdout?.on('data', (data) => {
      process.stdout.write(`[${name}] ${data}`);
    });

    child.stderr?.on('data', (data) => {
      process.stderr.write(`[${name}] ERROR: ${data}`);
    });
  }

  child.on('close', (code) => {
    console.log(`[${name}] Exited with code ${code}`);
  });

  return child;
};

console.log('[Launcher] Starting Monorepo Services...');

const socketPath = env.SIGNER_SOCKET_PATH;
if (fs.existsSync(socketPath)) {
  console.log(`[Launcher] Removing stale unix socket at ${socketPath}`);
  fs.unlinkSync(socketPath);
}

const children: ReturnType<typeof spawn>[] = [];

const signerPath = path.join(__dirname, 'packages/signer/src/server.ts');
const signer = spawnService('Signer', 'npx', ['ts-node', '-T', signerPath], env);
children.push(signer);

setTimeout(() => {
  const policyPath = path.join(__dirname, 'packages/policy/src/server.ts');
  const policy = spawnService('Policy', 'npx', ['ts-node', '-T', policyPath], env);
  children.push(policy);
  
  setTimeout(() => {
    const corePath = path.join(__dirname, 'packages/core/src/gateway/cli.ts');
    const args = process.argv.slice(2);
    const core = spawnService('Core', 'npx', ['ts-node', '-T', corePath, ...args], env, true);
    children.push(core);
  }, 1000);
}, 1000);

// Ensure all child processes are killed when launcher exits
const cleanup = () => {
  console.log('\n[Launcher] Shutting down all services...');
  children.forEach(child => {
    if (!child.killed && child.pid) {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch (e) {}
    }
  });
  // Kill any stray ts-node processes left behind by npx
  try {
    require('child_process').execSync('pkill -f ts-node');
  } catch (e) {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
