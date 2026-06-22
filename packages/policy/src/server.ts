import { initSafeLogger } from '../../core/src/utils/safeLogger';
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
import { unpack } from 'msgpackr';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Anti-Crash] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Anti-Crash] Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.POLICY_PORT || 3001;
const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
let JWT_SECRET = '';
try {
  JWT_SECRET = fs.readFileSync(tokenPath, 'utf8').trim();
} catch (e) {
  console.error("Missing runtime.token. Please run Nyxora launcher.");
  process.exit(1);
}

const SIGNER_SOCKET = process.env.SIGNER_SOCKET_PATH || '/tmp/nyxora-signer.sock';

const app = express();
app.use(express.json());

// MessagePack Parser Middleware for Hyper-Optimized IPC
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/msgpack') {
    let chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        req.body = unpack(Buffer.concat(chunks));
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

let policyRules: any = {};
try {
  const policyPath = getPath('policy.yaml');
  const file = fs.readFileSync(policyPath, 'utf8');
  policyRules = yaml.parse(file);
} catch (e) {
  console.log('[Policy Engine] No policy.yaml found, using defaults.');
  policyRules = {
    max_usd_per_tx: 999999999,
    whitelist_only: false
  };
}

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
  const options = {
    socketPath: SIGNER_SOCKET,
    path: '/address',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwt.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`
    }
  };

  const signerReq = http.request(options, (signerRes) => {
    let data = '';
    signerRes.on('data', chunk => data += chunk);
    signerRes.on('end', () => res.status(signerRes.statusCode || 200).json(JSON.parse(data)));
  });

  signerReq.on('error', (e) => res.status(500).json({ error: 'Failed to contact Signer: ' + e.message }));
  signerReq.end();
});

app.post('/sign-typed-data', (req, res) => {
  const requestPayload = JSON.stringify(req.body);
  const options = {
    socketPath: SIGNER_SOCKET,
    path: '/sign-typed-data',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`,
      'Content-Length': Buffer.byteLength(requestPayload)
    }
  };

  const signerReq = http.request(options, (signerRes) => {
    let data = '';
    signerRes.on('data', chunk => data += chunk);
    signerRes.on('end', () => res.status(signerRes.statusCode || 200).json(JSON.parse(data)));
  });

  signerReq.on('error', (e) => res.status(500).json({ error: 'Failed to contact Signer for sign-typed-data: ' + e.message }));
  signerReq.write(requestPayload);
  signerReq.end();
});

app.post('/request-tx', (req, res) => {
  try {
    const payload = TxRequestSchema.parse(req.body);
    const txId = Math.random().toString(36).substring(7);
    
    // Auto-approve bypass for internal trusted features like CL/TP
    if (payload.autoApprove) {
        const providedSig = req.body.internalSignature;
        if (!providedSig) return res.status(403).json({ error: 'Missing internal signature for autoApprove' });
        
        // Ensure amountWei exists
        const amountWei = payload.details?.amountWei || '';
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payload.chainName + amountWei).digest('hex');
        
        if (providedSig !== expectedSig) {
            return res.status(403).json({ error: 'Invalid internal signature for autoApprove' });
        }

        const requestPayload = JSON.stringify({ txPayload: payload });
        const options = {
            socketPath: SIGNER_SOCKET,
            path: '/sign-transaction',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`,
                'Content-Length': Buffer.byteLength(requestPayload)
            }
        };

        const signerReq = http.request(options, (signerRes) => {
            let data = '';
            signerRes.on('data', chunk => data += chunk);
            signerRes.on('end', () => res.status(signerRes.statusCode || 200).json(JSON.parse(data)));
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
      const options = {
          socketPath: SIGNER_SOCKET,
          path: '/sign-transaction',
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`,
              'Content-Length': Buffer.byteLength(requestPayload)
          }
      };

      const signerReq = http.request(options, (signerRes) => {
          let data = '';
          signerRes.on('data', chunk => data += chunk);
          signerRes.on('end', () => res.status(signerRes.statusCode || 200).json(JSON.parse(data)));
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

app.post('/approve-tx/:id', (req, res) => {
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

  const requestPayload = JSON.stringify({
    txPayload: tx
  });

  const options = {
    socketPath: SIGNER_SOCKET,
    path: '/sign-transaction',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`,
      'Content-Length': Buffer.byteLength(requestPayload)
    }
  };

  const signerReq = http.request(options, (signerRes) => {
    let data = '';
    signerRes.on('data', chunk => data += chunk);
    signerRes.on('end', () => {
      tx.status = 'executed';
      res.json(JSON.parse(data));
    });
  });

  signerReq.on('error', (e) => {
    res.status(500).json({ error: 'Failed to contact Signer: ' + e.message });
  });

  signerReq.write(requestPayload);
  signerReq.end();
});

const POLICY_SOCKET = '/tmp/nyxora-policy.sock';

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

// Start UDS Server for Hyper-Optimized IPC
const udsServer = http.createServer(app);
if (fs.existsSync(POLICY_SOCKET)) fs.unlinkSync(POLICY_SOCKET);
udsServer.listen(POLICY_SOCKET, () => {
  console.log(`[Policy Engine] Listening on UDS ${POLICY_SOCKET} (Hyper-Optimized IPC)`);
});
