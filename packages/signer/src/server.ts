import { initSafeLogger } from '../../core/src/utils/safeLogger';
import { loadConfig } from '../../core/src/config/parser';
initSafeLogger();

import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import jwt from 'jsonwebtoken';
import { decryptKey } from './crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, publicActions } from 'viem';
import * as chains from 'viem/chains';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Anti-Crash] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Anti-Crash] Uncaught Exception:', error);
  process.exit(1);
});

const SOCKET_PATH = process.env.SIGNER_SOCKET_PATH || '/tmp/nyxora-signer.sock';
const tokenPathAuth = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
let JWT_SECRET = '';
try {
  JWT_SECRET = fs.readFileSync(tokenPathAuth, 'utf8').trim();
} catch (e) {
  console.error("Missing runtime.token in signer process.");
  process.exit(1);
}

const app = express();
app.use(express.json());

import { Entry } from '@napi-rs/keyring';

let vaultPrivateKey: `0x${string}` | null = null;
let vaultAddress: string | null = null;

// Auto-unlock from OS Keyring or fallback .env
async function loadPrivateKey() {
  try {
    const entry = new Entry('nyxora', 'wallet');
    const pk = await entry.getPassword();
    if (pk) {
      vaultPrivateKey = pk.startsWith('0x') ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`);
      const account = privateKeyToAccount(vaultPrivateKey);
      vaultAddress = account.address;
      console.log(`✅ [Signer] Vault unlocked securely from OS Keyring. Agent Address: ${vaultAddress}`);
      return;
    }
  } catch (e) {
    console.warn(`⚠️ [Signer] OS Keyring failed (module mismatch or headless). Using fallback.`);
  }

  // Fallback to vault.key
  const vaultPath = path.join(os.homedir(), '.nyxora', 'auth', 'vault.key');
  if (fs.existsSync(vaultPath)) {
    const stats = fs.statSync(vaultPath);
    const mode = stats.mode & 0o777;
    if (os.platform() !== 'win32' && mode !== 0o600) {
      console.error(`\n======================================================`);
      console.error(`FATAL: Insecure permissions detected on vault.key`);
      console.error(`File permissions must be strictly 0600 (-rw-------)`);
      console.error(`Current permissions: 0${mode.toString(8)}`);
      console.error(`Refusing to start. Please run: chmod 600 ${vaultPath}`);
      console.error(`======================================================\n`);
      process.exit(1);
    }

    const content = fs.readFileSync(vaultPath, 'utf8');
    const match = content.match(/PRIVATE_KEY=(.+)/);
    if (match && match[1]) {
      const pk = match[1].trim();
      vaultPrivateKey = pk.startsWith('0x') ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`);
      const account = privateKeyToAccount(vaultPrivateKey);
      vaultAddress = account.address;
      console.log(`✅ [Signer] Vault unlocked from vault.key fallback. Agent Address: ${vaultAddress}`);
    }
  } else {
    console.log(`❌ [Signer] No Private Key found in OS Keyring or vault.key. Web3 features will fail.`);
  }
}

// Load it immediately
loadPrivateKey();

// Nonce Management
const nonceLocks: Record<number, Promise<void>> = {};
const nonceCache: Record<number, number> = {};

function getChain(chainName: string) {
  const normalized = chainName.toLowerCase().replace(/_/g, '-');
  const normalizedSpace = chainName.toLowerCase().replace(/_/g, ' ');
  // @ts-ignore
  return Object.values(chains).find(c => c.name.toLowerCase() === normalizedSpace || c.name.toLowerCase() === normalized || (c as any).network === normalized) || chains.mainnet;
}

app.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(403).json({ error: 'Invalid internal token' });
  }
});

app.get('/address', (req, res) => {
  if (!vaultAddress) return res.status(403).json({ error: 'Vault is locked' });
  res.json({ address: vaultAddress });
});

app.post('/sign-transaction', async (req, res) => {
  const { txPayload } = req.body;
  if (!vaultPrivateKey) return res.status(403).json({ error: 'Vault is locked. Unlock first.' });
  if (!txPayload || !txPayload.chainName) return res.status(400).json({ error: 'Invalid payload' });
  
  try {
     const account = privateKeyToAccount(vaultPrivateKey);
     const chain = getChain(txPayload.chainName);
     
     const config = loadConfig();
     const customRpcRaw = config.web3?.rpc_urls?.[txPayload.chainName.toLowerCase()];
     let customRpc = undefined;
     if (customRpcRaw) {
       if (Array.isArray(customRpcRaw) && customRpcRaw.length > 0) customRpc = customRpcRaw[0];
       else if (typeof customRpcRaw === 'string' && customRpcRaw.trim()) customRpc = customRpcRaw.trim();
     }
     
     const client = createWalletClient({ account, chain, transport: http(customRpc, { timeout: 15000 }) }).extend(publicActions);
     const chainId = chain.id;

     // Mutex lock for nonce management
     if (!nonceLocks[chainId]) nonceLocks[chainId] = Promise.resolve();
     
     const result = await new Promise((resolve, reject) => {
       nonceLocks[chainId] = nonceLocks[chainId].then(async () => {
         try {
           const rpcNonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' });
           let nextNonce = Math.max(rpcNonce, nonceCache[chainId] || 0);
           
           const txRequest = txPayload.details?.txRequest || txPayload.details?.txData || txPayload;
           
           // Phase 2: Transaction Simulation (Dry-Run / Anti-Fail)
           try {
              await client.estimateGas({
                account,
                to: txRequest.to,
                data: txRequest.data,
                value: txRequest.value ? BigInt(txRequest.value) : 0n
              });
           } catch (simError: any) {
              throw new Error(`Simulation failed: ${simError.shortMessage || simError.message}`);
           }
           
           // @ts-ignore
           const hash = await client.sendTransaction({
             account,
             to: txRequest.to,
             data: txRequest.data,
             value: txRequest.value ? BigInt(txRequest.value) : 0n,
             nonce: nextNonce,
             gas: txRequest.gas ? BigInt(txRequest.gas) : undefined,
             maxFeePerGas: txRequest.maxFeePerGas ? BigInt(txRequest.maxFeePerGas) : undefined,
             maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas ? BigInt(txRequest.maxPriorityFeePerGas) : undefined,
           });
           nonceCache[chainId] = nextNonce + 1;
           resolve(hash);
         } catch (err: any) {
           reject(err);
         }
       }).catch(reject);
     });
     
     res.json({ hash: result });
  } catch (e: any) {
     res.status(500).json({ error: e.message });
  }
});



if (fs.existsSync(SOCKET_PATH)) {
  try {
    fs.unlinkSync(SOCKET_PATH);
  } catch (err) {
    console.error('Failed to unlink socket:', err);
  }
}

app.listen(SOCKET_PATH, () => {
  try {
    fs.chmodSync(SOCKET_PATH, 0o600);
    console.log(`[Signer Vault] Listening on Unix Socket: ${SOCKET_PATH}`);
  } catch (err) {
    console.error('Failed to chmod socket:', err);
  }
});

// Phase 3: Graceful Shutdown (Local Keyring Security)
const gracefulShutdown = () => {
  console.log('[Signer Vault] Received shutdown signal. Locking vault...');
  // @ts-ignore
  if (typeof vaultPrivateKey !== 'undefined') vaultPrivateKey = null; // Zero out memory reference
  try {
    if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
  } catch (e) {}
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
