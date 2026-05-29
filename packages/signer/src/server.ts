import express from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { decryptKey } from './crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, publicActions } from 'viem';
import * as chains from 'viem/chains';

const SOCKET_PATH = process.env.SIGNER_SOCKET_PATH || '/tmp/nyxora-signer.sock';
const JWT_SECRET = process.env.INTERNAL_AUTH_TOKEN;

if (!JWT_SECRET) {
  console.error("Missing INTERNAL_AUTH_TOKEN in signer process.");
  process.exit(1);
}

const app = express();
app.use(express.json());

let vaultPrivateKey: `0x${string}` | null = null;
let vaultAddress: string | null = null;

// Nonce Management
const nonceLocks: Record<number, Promise<void>> = {};
const nonceCache: Record<number, number> = {};

function getChain(chainName: string) {
  // @ts-ignore
  return Object.values(chains).find(c => c.name.toLowerCase() === chainName.toLowerCase() || (c as any).network === chainName.toLowerCase()) || chains.mainnet;
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

app.post('/unlock', (req, res) => {
  const { keystore, password } = req.body;
  try {
    const pk = decryptKey(keystore, password);
    vaultPrivateKey = pk.startsWith('0x') ? pk as `0x${string}` : `0x${pk}` as `0x${string}`;
    const account = privateKeyToAccount(vaultPrivateKey);
    vaultAddress = account.address;
    res.json({ success: true, address: vaultAddress });
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid password or keystore' });
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
     
     const client = createWalletClient({ account, chain, transport: http() }).extend(publicActions);
     const chainId = chain.id;

     // Mutex lock for nonce management
     if (!nonceLocks[chainId]) nonceLocks[chainId] = Promise.resolve();
     
     const result = await new Promise((resolve, reject) => {
       nonceLocks[chainId] = nonceLocks[chainId].then(async () => {
         try {
           const rpcNonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' });
           let nextNonce = Math.max(rpcNonce, nonceCache[chainId] || 0);
           
           const txRequest = txPayload.details?.txRequest || txPayload;
           
           // @ts-ignore
           const txHash = await client.sendTransaction({
             account,
             chain,
             to: txRequest.to,
             data: txRequest.data,
             value: txRequest.value ? BigInt(txRequest.value) : 0n,
             gas: txRequest.gasLimit ? (BigInt(txRequest.gasLimit) * 12n / 10n) : undefined,
             nonce: nextNonce
           });
           
           nonceCache[chainId] = nextNonce + 1;
           resolve({ success: true, signedHash: txHash });
         } catch (e) {
           reject(e);
         }
       }).catch(() => {});
     });
     
     res.json(result);
  } catch (error: any) {
     res.status(500).json({ error: `Signing failed: ${error.message}` });
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
