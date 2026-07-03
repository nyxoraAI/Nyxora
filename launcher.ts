// @ts-ignore
import { initSafeLogger } from './packages/core/src/utils/safeLogger';
initSafeLogger();

import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

// Fix Node 18+ native fetch randomly failing on dual-stack VPS (IPv6 issues)
dns.setDefaultResultOrder('ipv4first');

const INTERNAL_AUTH_TOKEN = crypto.randomBytes(64).toString('hex');
console.log(`[Launcher] Generated Internal Auth Token: ${INTERNAL_AUTH_TOKEN.substring(0, 8)}...`);

const nyxoraDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora');
const authDir = path.join(nyxoraDir, 'auth');
if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
const tokenPath = path.join(authDir, 'runtime.token');
fs.writeFileSync(tokenPath, INTERNAL_AUTH_TOKEN, { mode: 0o600 });
console.log(`[Launcher] Secured runtime token at ${tokenPath} (0600)`);

const env = {
  ...process.env,
  INTERNAL_AUTH_TOKEN,
  SIGNER_SOCKET_PATH: '/tmp/nyxora-signer.sock',
  TS_NODE_CACHE: 'false',
  PYTHONUNBUFFERED: '1'
};

const spawnService = (name: string, command: string, args: string[], env: any, inheritStdio: boolean = false, cwd?: string) => {
  let child: ReturnType<typeof spawn>;
  let crashCount = 0;
  let crashWindowStart = Date.now();
  let isShuttingDown = false;

  const startProcess = () => {
    const spawnOpts: any = { env, stdio: inheritStdio ? 'inherit' : 'pipe' };
    if (cwd) spawnOpts.cwd = cwd;
    child = spawn(command, args, spawnOpts);
    child.on('error', (err) => {
      console.error(`[Launcher] Failed to spawn ${name}:`, err.message);
      isShuttingDown = true; // Prevent retry loop if spawn fails
    });

    if (!inheritStdio) {
      child.stdout?.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
      child.stderr?.on('data', (data) => {
        const msg = data.toString();
        if (msg.toLowerCase().includes('warn') || msg.toLowerCase().includes('info')) {
          process.stderr.write(`[${name}] ${msg}`);
        } else {
          process.stderr.write(`[${name}] ERROR: ${msg}`);
        }
      });
    }

    child.on('close', async (code) => {
      console.log(`[${name}] Exited with code ${code}`);
      if (isShuttingDown) return;

      const now = Date.now();
      if (now - crashWindowStart > 60000) {
        crashCount = 0;
        crashWindowStart = now;
      }
      
      crashCount++;
      if (crashCount > 5) {
        console.error(`[Launcher] FATAL: ${name} crashed 5 times in 1 minute. Initiating emergency shutdown.`);
        isShuttingDown = true;
        
        try {
          const yaml = require('yaml');
          const configPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora', 'config', 'config.yaml');
          // Fallback check just in case it hasn't migrated yet
          const actualConfigPath = fs.existsSync(configPath) ? configPath : path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora', 'config.yaml');
          if (fs.existsSync(actualConfigPath)) {
            const configStr = fs.readFileSync(actualConfigPath, 'utf8');
            const config = yaml.parse(configStr);
            const tgToken = config?.telegram?.bot_token;
            const tgChatId = config?.telegram?.admin_chat_id;
            
            if (tgToken && tgChatId) {
               const alertText = config?.alerts?.emergency_text || "🚨 FATAL ERROR: A critical process has crashed repeatedly. Nyxora is executing an emergency auto-shutdown to protect your system. Please check the server logs.";
               await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({ chat_id: tgChatId, text: alertText })
               }).catch(() => {});
            }
          }
        } catch(e) {}
        
        process.exit(1);
        return;
      }

      console.log(`[Launcher] Restarting ${name} in 3 seconds... (Attempt ${crashCount}/5)`);
      setTimeout(startProcess, 3000);
    });
  };

  startProcess();

  return {
    kill: () => {
      isShuttingDown = true;
      if (child && !child.killed && child.pid) {
        try { process.kill(child.pid, 'SIGTERM'); } catch(e) {}
      }
    },
    forceKill: () => {
      if (child && !child.killed && child.pid) {
        try { process.kill(child.pid, 'SIGKILL'); } catch(e) {}
      }
    }
  };
};

console.log('[Launcher] Starting Monorepo Services...');

const socketPath = env.SIGNER_SOCKET_PATH;
if (fs.existsSync(socketPath)) {
  console.log(`[Launcher] Removing stale unix socket at ${socketPath}`);
  fs.unlinkSync(socketPath);
}

const children: { kill: () => void; forceKill: () => void; }[] = [];

const __filenameResolved = __filename;
const __dirnameResolved = __dirname;

const isCompiled = __filenameResolved.endsWith('.js');
const ext = isCompiled ? '.js' : '.ts';
const cmd = isCompiled ? 'node' : path.join(__dirnameResolved, 'node_modules', '.bin', 'ts-node');
const baseArgs = isCompiled ? [] : ['-T'];

const signerPath = path.join(__dirnameResolved, `packages/signer/src/server${ext}`);
const signer = spawnService('Signer', cmd, [...baseArgs, signerPath], env);
children.push(signer);

setTimeout(() => {
  const policyPath = path.join(__dirnameResolved, `packages/policy/src/server${ext}`);
  const policy = spawnService('Policy', cmd, [...baseArgs, policyPath], env);
  children.push(policy);
  
  setTimeout(() => {
    // Spawn ML Engine (Python Sidecar)
    const pythonPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora', 'ml-engine', 'venv', 'bin', 'python');
    if (fs.existsSync(pythonPath)) {
      const mlDir = path.join(__dirnameResolved, 'packages', 'ml-engine');
      const mlArgs = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'];
      const mlEngine = spawnService('ML Engine', pythonPath, mlArgs, env, false, mlDir);
      children.push(mlEngine);
    } else {
      console.warn('[Launcher] Warning: Python virtual environment not found. Did you run setup?');
    }

    setTimeout(() => {
      const corePath = path.join(__dirnameResolved, `packages/core/src/gateway/cli${ext}`);
      const args = process.argv.slice(2);
      const core = spawnService('Core', cmd, [...baseArgs, corePath, ...args], env, true);
      children.push(core);
    }, 1000);
  }, 1000);
}, 1000);

// Ensure all child processes are killed when launcher exits
let isCleaningUp = false;
const cleanup = () => {
  if (isCleaningUp) return;
  isCleaningUp = true;
  console.log('\n[Launcher] Shutting down all services...');
  children.forEach(c => c.kill());
  // Give them a moment to cleanup
  setTimeout(() => {
    children.forEach(c => {
      try { c.forceKill(); } catch(e) {}
    });
    try {
      require('child_process').execSync('pkill -f ts-node');
      require('child_process').execSync('pkill -f uvicorn');
    } catch (e) {}
    process.exit(0);
  }, 1000);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
