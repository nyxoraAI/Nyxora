"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("./crypto");
const accounts_1 = require("viem/accounts");
const viem_1 = require("viem");
const chains = __importStar(require("viem/chains"));
const SOCKET_PATH = process.env.SIGNER_SOCKET_PATH || '/tmp/nyxora-signer.sock';
const JWT_SECRET = process.env.INTERNAL_AUTH_TOKEN;
if (!JWT_SECRET) {
    console.error("Missing INTERNAL_AUTH_TOKEN in signer process.");
    process.exit(1);
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
let vaultPrivateKey = null;
let vaultAddress = null;
// Nonce Management
const nonceLocks = {};
const nonceCache = {};
function getChain(chainName) {
    // @ts-ignore
    return Object.values(chains).find(c => c.name.toLowerCase() === chainName.toLowerCase() || c.network === chainName.toLowerCase()) || chains.mainnet;
}
app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader)
        return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.split(' ')[1];
    try {
        jsonwebtoken_1.default.verify(token, JWT_SECRET);
        next();
    }
    catch (e) {
        res.status(403).json({ error: 'Invalid internal token' });
    }
});
app.post('/unlock', (req, res) => {
    const { keystore, password } = req.body;
    try {
        const pk = (0, crypto_1.decryptKey)(keystore, password);
        vaultPrivateKey = pk.startsWith('0x') ? pk : `0x${pk}`;
        const account = (0, accounts_1.privateKeyToAccount)(vaultPrivateKey);
        vaultAddress = account.address;
        res.json({ success: true, address: vaultAddress });
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid password or keystore' });
    }
});
app.get('/address', (req, res) => {
    if (!vaultAddress)
        return res.status(403).json({ error: 'Vault is locked' });
    res.json({ address: vaultAddress });
});
app.post('/sign-transaction', async (req, res) => {
    const { txPayload } = req.body;
    if (!vaultPrivateKey)
        return res.status(403).json({ error: 'Vault is locked. Unlock first.' });
    if (!txPayload || !txPayload.chainName)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const account = (0, accounts_1.privateKeyToAccount)(vaultPrivateKey);
        const chain = getChain(txPayload.chainName);
        const client = (0, viem_1.createWalletClient)({ account, chain, transport: (0, viem_1.http)() }).extend(viem_1.publicActions);
        const chainId = chain.id;
        // Mutex lock for nonce management
        if (!nonceLocks[chainId])
            nonceLocks[chainId] = Promise.resolve();
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
                }
                catch (e) {
                    reject(e);
                }
            }).catch(() => { });
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: `Signing failed: ${error.message}` });
    }
});
if (fs_1.default.existsSync(SOCKET_PATH)) {
    try {
        fs_1.default.unlinkSync(SOCKET_PATH);
    }
    catch (err) {
        console.error('Failed to unlink socket:', err);
    }
}
app.listen(SOCKET_PATH, () => {
    try {
        fs_1.default.chmodSync(SOCKET_PATH, 0o600);
        console.log(`[Signer Vault] Listening on Unix Socket: ${SOCKET_PATH}`);
    }
    catch (err) {
        console.error('Failed to chmod socket:', err);
    }
});
