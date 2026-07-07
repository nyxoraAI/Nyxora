import { initSafeLogger } from '../../core/src/utils/safeLogger';
console.log(`--- SERVER.TS STARTED (PID: ${process.pid}) ---`);
initSafeLogger();
import { getPath } from '../../core/src/config/paths';

import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import yaml from 'yaml';
import http from 'http';
import { z } from 'zod';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { decode } from '@msgpack/msgpack';
import { checkRegistryStatus } from '../../core/src/web3/skills/checkRegistryStatus';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Anti-Crash] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Anti-Crash] Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.POLICY_PORT || 3001;
const IS_WINDOWS = process.platform === 'win32';
const SIGNER_PORT = parseInt(process.env.SIGNER_PORT || '3002', 10);
const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
let JWT_SECRET = '';
try {
  JWT_SECRET = fs.readFileSync(tokenPath, 'utf8').trim();
} catch (e) {
  console.error("Missing runtime.token. Please run Nyxora launcher.");
  process.exit(1);
}

// Cross-platform: Unix socket on Linux/Mac, TCP fallback on Windows
const SIGNER_SOCKET = IS_WINDOWS
  ? undefined
  : (process.env.SIGNER_SOCKET_PATH || '/tmp/nyxora-signer.sock');

// Helper: build http.request options for Signer IPC (cross-platform)
function signerRequestOptions(path_: string, method: string, contentLength?: number): http.RequestOptions {
  const token = jwt.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' });
  if (!IS_WINDOWS && SIGNER_SOCKET && fs.existsSync(SIGNER_SOCKET)) {
    // Unix socket path (Linux/Mac)
    return { socketPath: SIGNER_SOCKET, path: path_, method, headers: { 'Authorization': `Bearer ${token}`, ...(contentLength !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': contentLength } : {}) } };
  }
  // TCP fallback (Windows or if socket missing)
  return { host: '127.0.0.1', port: SIGNER_PORT, path: path_, method, headers: { 'Authorization': `Bearer ${token}`, ...(contentLength !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': contentLength } : {}) } };
}


const app = express();
app.use(express.json());

// MessagePack Parser Middleware for Hyper-Optimized IPC
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/msgpack') {
    let chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        req.body = decode(Buffer.concat(chunks));
        next();
      } catch (e) {
        res.status(400).json({ error: 'Invalid MessagePack payload' });
      }
    });
  } else {
    next();
  }
});

const TxRequestSchema = z.object({
  type: z.enum(['transfer', 'swap', 'bridge', 'mint', 'custom']),
  chainName: z.string(),
  details: z.any(),
  autoApprove: z.boolean().optional()
});

import chokidar from 'chokidar';

let policyRules: any = {};
const policyPath = getPath('policy.yaml');

const loadPolicy = () => {
  try {
    const file = fs.readFileSync(policyPath, 'utf8');
    policyRules = yaml.parse(file) || {};
  } catch (e) {
    console.log('[Policy Engine] No policy.yaml found or parse error, using defaults.');
    policyRules = { max_usd_per_tx: 999999999, whitelist_only: false };
  }
};

loadPolicy();

chokidar.watch(policyPath, { persistent: true }).on('change', () => {
  console.log('[Policy Engine] Detected change in policy.yaml. Hot-reloading rules...');
  loadPolicy();
});

const pendingTransactions: Record<string, any> = {};

app.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  
  const token = authHeader.split(' ')[1];
  try {
    if (token === JWT_SECRET) {
      return next();
    }
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(403).json({ error: 'Invalid internal token' });
  }
});

// Proxy GET /address to Signer
app.get('/address', (req, res) => {
  const options = signerRequestOptions('/address', 'GET');

  const signerReq = http.request(options, (signerRes) => {
    let data = '';
    signerRes.on('data', chunk => data += chunk);
    signerRes.on('end', () => {
      try {
        res.status(signerRes.statusCode || 200).json(JSON.parse(data));
      } catch (e) {
        res.status(500).json({ error: 'Invalid response from Signer' });
      }
    });
  });

  signerReq.on('error', (e) => res.status(500).json({ error: 'Failed to contact Signer: ' + e.message }));
  signerReq.end();
});


app.post('/request-tx', async (req, res) => {
  try {
    const payload = TxRequestSchema.parse(req.body);
    const txId = crypto.randomUUID();
    
    // ENFORCE End-to-End HMAC Signature for all requests (MCP or internal)
    const providedSig = req.body.internalSignature;
    if (!providedSig) return res.status(403).json({ error: 'Missing internal signature' });
    
    const amountWei = payload.details?.amountWei || '';
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payload.chainName + amountWei).digest('hex');
    
    if (providedSig !== expectedSig) {
        return res.status(403).json({ error: 'Invalid internal signature. Request rejected.' });
    }

    // --- On-Chain Kill-Switch Interceptor ---
    const registryCheck = await checkRegistryStatus();
    if (!registryCheck.isActive) {
        return res.status(403).json({ error: `[On-Chain Policy] ${registryCheck.reason}` });
    }
    // ----------------------------------------

    // Auto-approve bypass for internal trusted features like CL/TP
    if (payload.autoApprove) {
        const requestPayload = JSON.stringify({ txPayload: payload });
        const options = signerRequestOptions('/sign-transaction', 'POST', Buffer.byteLength(requestPayload));

        const signerReq = http.request(options, (signerRes) => {
            let data = '';
            signerRes.on('data', chunk => data += chunk);
            signerRes.on('end', () => {
              try {
                res.status(signerRes.statusCode || 200).json(JSON.parse(data));
              } catch (e) {
                res.status(500).json({ error: 'Invalid response from Signer' });
              }
            });
        });

        signerReq.on('error', (e) => res.status(500).json({ error: 'AutoApprove failed: ' + e.message }));
        signerReq.write(requestPayload);
        signerReq.end();
        return;
    }

    
    // 1. Whitelist Check
    if (policyRules.whitelist_only === true) {
      const toAddress = payload.details?.to || payload.details?.contractAddress;
      const whitelist: string[] = policyRules.whitelist || [];
      if (toAddress && !whitelist.some(addr => addr.toLowerCase() === toAddress.toLowerCase())) {
        return res.status(403).json({ error: 'Transaction rejected: Destination address not in whitelist' });
      }
    }

    // 2. Limit Check (Basic simulation)
    const estimatedUsd = payload.details?.estimatedUsdValue || 0;
    if (estimatedUsd > (policyRules.max_usd_per_tx || 999999999)) {
      return res.status(403).json({ error: 'Transaction rejected: Exceeds max USD per transaction limit' });
    }

    // 3. Approval Routing
    if (policyRules.require_approval === true) {
      pendingTransactions[txId] = { ...payload, status: 'pending', id: txId };
      return res.json({ success: true, status: 'pending', txId });
    } else {
      // Auto-Sign Transaction if global require_approval is false
      const requestPayload = JSON.stringify({ txPayload: payload });
      const options = signerRequestOptions('/sign-transaction', 'POST', Buffer.byteLength(requestPayload));

      const signerReq = http.request(options, (signerRes) => {
          let data = '';
          signerRes.on('data', chunk => data += chunk);
          signerRes.on('end', () => {
            try {
              res.status(signerRes.statusCode || 200).json(JSON.parse(data));
            } catch (e) {
              res.status(500).json({ error: 'Invalid response from Signer' });
            }
          });
      });

      signerReq.on('error', (e) => res.status(500).json({ error: 'Auto-Sign failed: ' + e.message }));
      signerReq.write(requestPayload);
      signerReq.end();
      return;
    }

  } catch (error) {
    res.status(400).json({ error: 'Invalid transaction payload' });
  }
});

app.get('/pending-tx', (req, res) => {
  res.json(Object.values(pendingTransactions).filter(tx => tx.status === 'pending'));
});

app.post('/approve-tx/:id', async (req, res) => {
  const txId = req.params.id;
  const { nonce, approvalHash } = req.body;
  const tx = pendingTransactions[txId];
  
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction not pending' });
  if (!nonce || !approvalHash) return res.status(400).json({ error: 'Missing cryptographic approval parameters' });

  // Cryptographically Bound Approval verification
  const expectedHash = crypto.createHash('sha256').update(txId + nonce + JWT_SECRET).digest('hex');
  if (approvalHash !== expectedHash) {
      return res.status(403).json({ error: 'Invalid Challenge Nonce Hash. Cryptographic approval failed.' });
  }

  // --- On-Chain Kill-Switch Interceptor (Just-in-Time) ---
  const registryCheck = await checkRegistryStatus();
  if (!registryCheck.isActive) {
      return res.status(403).json({ error: `[On-Chain Policy] ${registryCheck.reason}` });
  }
  // -------------------------------------------------------

  const requestPayload = JSON.stringify({
    txPayload: tx
  });

  const options = signerRequestOptions('/sign-transaction', 'POST', Buffer.byteLength(requestPayload));

  const signerReq = http.request(options, (signerRes) => {
    let data = '';
    signerRes.on('data', chunk => data += chunk);
    signerRes.on('end', () => {
      tx.status = 'executed';
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.status(500).json({ error: 'Invalid response from Signer' });
      }
    });
  });

  signerReq.on('error', (e) => {
    res.status(500).json({ error: 'Failed to contact Signer: ' + e.message });
  });

  signerReq.write(requestPayload);
  signerReq.end();
});


const POLICY_SOCKET = IS_WINDOWS ? undefined : '/tmp/nyxora-policy.sock';

console.log('--- APP.LISTEN CALLED ---');
const server = app.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`[Policy Engine] Listening on 127.0.0.1:${PORT} (Secured Local Loopback)`);
});

server.on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[Policy Engine] Port ${PORT} is already in use. Is Nyxora already running?`);
    process.exit(1);
  } else {
    console.error(`[Policy Engine] Server error:`, e);
    process.exit(1);
  }
});

// Start UDS Server for Hyper-Optimized IPC (Linux/Mac only)
if (!IS_WINDOWS) {
  const udsServer = http.createServer(app);
  if (POLICY_SOCKET && fs.existsSync(POLICY_SOCKET)) fs.unlinkSync(POLICY_SOCKET);
  udsServer.listen(POLICY_SOCKET!, () => {
    console.log(`[Policy Engine] Listening on UDS ${POLICY_SOCKET} (Hyper-Optimized IPC)`);
  });
}

const gracefulShutdown = () => {
  console.log('[Policy Engine] Received shutdown signal. Cleaning up IPC...');
  if (!IS_WINDOWS && POLICY_SOCKET) {
    try {
      if (fs.existsSync(POLICY_SOCKET)) fs.unlinkSync(POLICY_SOCKET);
    } catch {}
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

