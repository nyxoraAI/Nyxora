import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import http from 'http';
import { encode } from '@msgpack/msgpack';

function getInternalToken(): string | undefined {
  try {
    const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf8').trim();
    }
  } catch (e) {}
  return undefined;
}

export async function getAddress(): Promise<string> {
  const token = getInternalToken();
  return new Promise((resolve, reject) => {
    const POLICY_SOCKET = '/tmp/nyxora-policy.sock';
    const options = {
      socketPath: fs.existsSync(POLICY_SOCKET) ? POLICY_SOCKET : undefined,
      host: fs.existsSync(POLICY_SOCKET) ? undefined : '127.0.0.1',
      port: fs.existsSync(POLICY_SOCKET) ? undefined : (process.env.POLICY_PORT || 3001),
      path: '/address',
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(data));
            return;
          }
          const parsed = JSON.parse(data);
          resolve(parsed.address);
        } catch (e: any) {
          reject(new Error(`Failed to get address from vault: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Failed to get address from vault: ${error.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy(new Error('Timeout'));
    });

    req.end();
  });
}

export async function submitTransaction(txPayload: any): Promise<string> {
  const token = getInternalToken();
  if (txPayload.autoApprove) {
    txPayload.details = txPayload.details || {};
    // ROOT FIX: Paksa amountWei selalu ada di payload agar Policy Engine tidak salah baca
    txPayload.details.amountWei = txPayload.details.amountWei || txPayload.details.valueWei || "0";
    
    const amountWei = txPayload.details.amountWei;
    const secret = getInternalToken() || '';
    txPayload.internalSignature = crypto.createHmac('sha256', secret).update(txPayload.chainName + amountWei).digest('hex');
  }
  return new Promise((resolve, reject) => {
    const POLICY_SOCKET = '/tmp/nyxora-policy.sock';
    const sanitizedPayload = JSON.parse(JSON.stringify(txPayload, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    const payloadBuffer = encode(sanitizedPayload);

    const options = {
      socketPath: fs.existsSync(POLICY_SOCKET) ? POLICY_SOCKET : undefined,
      host: fs.existsSync(POLICY_SOCKET) ? undefined : '127.0.0.1',
      port: fs.existsSync(POLICY_SOCKET) ? undefined : (process.env.POLICY_PORT || 3001),
      path: '/request-tx',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/msgpack',
        'Content-Length': payloadBuffer.length,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(parsed.error || 'Failed to submit transaction'));
            return;
          }
          if (parsed.status === 'pending') {
            resolve(`Pending (ID: ${parsed.txId})`);
            return;
          }
          resolve(parsed.signedHash || parsed.hash || parsed.txHash || parsed.status || 'Transaction executed successfully (No Hash returned)');
        } catch (e: any) {
          reject(new Error(`Failed to parse vault response: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Transaction submission failed: ${error.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy(new Error('Timeout'));
    });

    req.write(payloadBuffer);
    req.end();
  });
}

