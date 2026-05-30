import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const INTERNAL_AUTH_TOKEN = crypto.randomBytes(64).toString('hex');
console.log(`[Launcher] Generated Internal Auth Token: ${INTERNAL_AUTH_TOKEN.substring(0, 8)}...`);

const env = {
  ...process.env,
  INTERNAL_AUTH_TOKEN,
  SIGNER_SOCKET_PATH: '/tmp/nyxora-signer.sock'
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

const signerPath = path.join(__dirname, 'packages/signer/src/server.ts');
const signer = spawnService('Signer', 'npx', ['ts-node', '-T', signerPath], env);

setTimeout(() => {
  const policyPath = path.join(__dirname, 'packages/policy/src/server.ts');
  const policy = spawnService('Policy', 'npx', ['ts-node', '-T', policyPath], env);
  
  setTimeout(() => {
    const corePath = path.join(__dirname, 'packages/core/src/gateway/cli.ts');
    const args = process.argv.slice(2);
    const core = spawnService('Core', 'npx', ['ts-node', '-T', corePath, ...args], env, true);
  }, 1000);
}, 1000);
