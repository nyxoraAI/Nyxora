"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const http_1 = __importDefault(require("http"));
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const PORT = 3001;
const JWT_SECRET = process.env.INTERNAL_AUTH_TOKEN;
const SIGNER_SOCKET = process.env.SIGNER_SOCKET_PATH || '/tmp/nyxora-signer.sock';
if (!JWT_SECRET) {
    console.error("Missing INTERNAL_AUTH_TOKEN in policy process.");
    process.exit(1);
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
const TxRequestSchema = zod_1.z.object({
    type: zod_1.z.enum(['transfer', 'swap', 'bridge', 'mint', 'custom']),
    chainName: zod_1.z.string(),
    details: zod_1.z.any(),
    autoApprove: zod_1.z.boolean().optional()
});
let policyRules = {};
try {
    const policyPath = path_1.default.join(process.cwd(), 'policy.yaml');
    const file = fs_1.default.readFileSync(policyPath, 'utf8');
    policyRules = yaml_1.default.parse(file);
}
catch (e) {
    console.log('[Policy Engine] No policy.yaml found, using defaults.');
    policyRules = {
        max_usd_per_tx: 50,
        whitelist_only: false
    };
}
const pendingTransactions = {};
app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader)
        return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.split(' ')[1];
    try {
        if (token === JWT_SECRET) {
            return next();
        }
        jsonwebtoken_1.default.verify(token, JWT_SECRET);
        next();
    }
    catch (e) {
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
            'Authorization': `Bearer ${jsonwebtoken_1.default.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`
        }
    };
    const signerReq = http_1.default.request(options, (signerRes) => {
        let data = '';
        signerRes.on('data', chunk => data += chunk);
        signerRes.on('end', () => res.status(signerRes.statusCode || 200).json(JSON.parse(data)));
    });
    signerReq.on('error', (e) => res.status(500).json({ error: 'Failed to contact Signer: ' + e.message }));
    signerReq.end();
});
// Proxy POST /unlock to Signer
app.post('/unlock', (req, res) => {
    const { keystore, password } = req.body;
    const requestPayload = JSON.stringify({ keystore, password });
    const options = {
        socketPath: SIGNER_SOCKET,
        path: '/unlock',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jsonwebtoken_1.default.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`,
            'Content-Length': Buffer.byteLength(requestPayload)
        }
    };
    const signerReq = http_1.default.request(options, (signerRes) => {
        let data = '';
        signerRes.on('data', chunk => data += chunk);
        signerRes.on('end', () => res.status(signerRes.statusCode || 200).json(JSON.parse(data)));
    });
    signerReq.on('error', (e) => res.status(500).json({ error: 'Failed to unlock vault: ' + e.message }));
    signerReq.write(requestPayload);
    signerReq.end();
});
app.post('/request-tx', (req, res) => {
    try {
        const payload = TxRequestSchema.parse(req.body);
        const txId = Math.random().toString(36).substring(7);
        // Auto-approve bypass for internal trusted features like CL/TP
        if (payload.autoApprove) {
            const requestPayload = JSON.stringify({ txPayload: payload });
            const options = {
                socketPath: SIGNER_SOCKET,
                path: '/sign-transaction',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jsonwebtoken_1.default.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`,
                    'Content-Length': Buffer.byteLength(requestPayload)
                }
            };
            const signerReq = http_1.default.request(options, (signerRes) => {
                let data = '';
                signerRes.on('data', chunk => data += chunk);
                signerRes.on('end', () => res.status(signerRes.statusCode || 200).json(JSON.parse(data)));
            });
            signerReq.on('error', (e) => res.status(500).json({ error: 'AutoApprove failed: ' + e.message }));
            signerReq.write(requestPayload);
            signerReq.end();
            return;
        }
        // Simulate policy evaluation
        if (policyRules.max_usd_per_tx < 1000) {
            pendingTransactions[txId] = { ...payload, status: 'pending', id: txId };
            return res.json({ success: true, status: 'pending', txId });
        }
        return res.status(403).json({ error: 'Transaction rejected by policy' });
    }
    catch (error) {
        res.status(400).json({ error: 'Invalid transaction payload' });
    }
});
app.get('/pending-tx', (req, res) => {
    res.json(Object.values(pendingTransactions).filter(tx => tx.status === 'pending'));
});
app.post('/approve-tx/:id', (req, res) => {
    const txId = req.params.id;
    const tx = pendingTransactions[txId];
    if (!tx)
        return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'pending')
        return res.status(400).json({ error: 'Transaction not pending' });
    const requestPayload = JSON.stringify({
        txPayload: tx
    });
    const options = {
        socketPath: SIGNER_SOCKET,
        path: '/sign-transaction',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jsonwebtoken_1.default.sign({ service: 'policy' }, JWT_SECRET, { expiresIn: '1m' })}`,
            'Content-Length': Buffer.byteLength(requestPayload)
        }
    };
    const signerReq = http_1.default.request(options, (signerRes) => {
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
app.listen(PORT, '127.0.0.1', () => {
    console.log(`[Policy Engine] Listening on 127.0.0.1:${PORT}`);
});
