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
import chokidar from 'chokidar';

// Hide relative imports from TypeScript to prevent parsing 'core' package during SDK build
const pathsModule = '../../core/src/config/paths';
const registryModule = '../../core/src/web3/skills/checkRegistryStatus';

let getPath: (filename: string) => string;
let checkRegistryStatus: () => Promise<{ isActive: boolean; reason: string }>;

try {
  getPath = require(pathsModule).getPath;
} catch (e) {
  // Fallback for standalone SDK usage
  getPath = (filename: string) => path.join(os.homedir(), '.nyxora', filename);
}

try {
  checkRegistryStatus = require(registryModule).checkRegistryStatus;
} catch (e) {
  // Fallback
  checkRegistryStatus = async () => ({ isActive: true, reason: 'SDK Mode (No Registry Check)' });
}


export const TxRequestSchema = z.object({
  type: z.enum(['transfer', 'swap', 'bridge', 'mint', 'custom']),
  chainName: z.string(),
  details: z.any(),
  autoApprove: z.boolean().optional()
});

export interface PolicyEngineOptions {
  jwtSecret?: string;
  signerPort?: number;
  signerSocket?: string;
}

export function createPolicyEngine(options: PolicyEngineOptions = {}) {
  const IS_WINDOWS = process.platform === 'win32';
  const SIGNER_PORT = options.signerPort || parseInt(process.env.SIGNER_PORT || '3002', 10);
  
  let JWT_SECRET = options.jwtSecret || '';
  if (!JWT_SECRET) {
    const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
    try {
      JWT_SECRET = fs.readFileSync(tokenPath, 'utf8').trim();
    } catch (e) {
      console.error("Missing runtime.token. Please run Nyxora launcher.");
      process.exit(1);
    }
  }

  const SIGNER_SOCKET = options.signerSocket !== undefined 
    ? options.signerSocket 
    : (IS_WINDOWS ? undefined : (process.env.SIGNER_SOCKET_PATH || '/tmp/nyxora-signer.sock'));

  function signerRequestOptions(path_: string, method: string, contentLength?: number): http.RequestOptions {
    const token = jwt.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' });
    if (!IS_WINDOWS && SIGNER_SOCKET && fs.existsSync(SIGNER_SOCKET)) {
      return { socketPath: SIGNER_SOCKET, path: path_, method, headers: { 'Authorization': `Bearer ${token}`, ...(contentLength !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': contentLength } : {}) } };
    }
    return { host: '127.0.0.1', port: SIGNER_PORT, path: path_, method, headers: { 'Authorization': `Bearer ${token}`, ...(contentLength !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': contentLength } : {}) } };
  }

  const app = express();
  app.use(express.json());

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

  app.get('/address', (req, res) => {
    const requestOptions = signerRequestOptions('/address', 'GET');

    const signerReq = http.request(requestOptions, (signerRes) => {
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
      
      const providedSig = req.body.internalSignature;
      if (!providedSig) return res.status(403).json({ error: 'Missing internal signature' });
      
      const amountWei = payload.details?.amountWei || '';
      const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payload.chainName + amountWei).digest('hex');
      
      if (providedSig !== expectedSig) {
          return res.status(403).json({ error: 'Invalid internal signature. Request rejected.' });
      }

      const registryCheck = await checkRegistryStatus();
      if (!registryCheck.isActive) {
          return res.status(403).json({ error: `[On-Chain Policy] ${registryCheck.reason}` });
      }

      if (payload.autoApprove) {
          const requestPayload = JSON.stringify({ txPayload: payload });
          const requestOptions = signerRequestOptions('/sign-transaction', 'POST', Buffer.byteLength(requestPayload));

          const signerReq = http.request(requestOptions, (signerRes) => {
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
      
      if (policyRules.whitelist_only === true) {
        const toAddress = payload.details?.to || payload.details?.contractAddress;
        const whitelist: string[] = policyRules.whitelist || [];
        if (toAddress && !whitelist.some(addr => addr.toLowerCase() === toAddress.toLowerCase())) {
          return res.status(403).json({ error: 'Transaction rejected: Destination address not in whitelist' });
        }
      }

      const estimatedUsd = payload.details?.estimatedUsdValue || 0;
      if (estimatedUsd > (policyRules.max_usd_per_tx || 999999999)) {
        return res.status(403).json({ error: 'Transaction rejected: Exceeds max USD per transaction limit' });
      }

      if (policyRules.require_approval === true) {
        pendingTransactions[txId] = { ...payload, status: 'pending', id: txId };
        return res.json({ success: true, status: 'pending', txId });
      } else {
        const requestPayload = JSON.stringify({ txPayload: payload });
        const requestOptions = signerRequestOptions('/sign-transaction', 'POST', Buffer.byteLength(requestPayload));

        const signerReq = http.request(requestOptions, (signerRes) => {
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

    const expectedHash = crypto.createHash('sha256').update(txId + nonce + JWT_SECRET).digest('hex');
    if (approvalHash !== expectedHash) {
        return res.status(403).json({ error: 'Invalid Challenge Nonce Hash. Cryptographic approval failed.' });
    }

    const registryCheck = await checkRegistryStatus();
    if (!registryCheck.isActive) {
        return res.status(403).json({ error: `[On-Chain Policy] ${registryCheck.reason}` });
    }

    const requestPayload = JSON.stringify({
      txPayload: tx
    });

    const requestOptions = signerRequestOptions('/sign-transaction', 'POST', Buffer.byteLength(requestPayload));

    const signerReq = http.request(requestOptions, (signerRes) => {
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

  return app;
}
