"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAddress = getAddress;
exports.submitTransaction = submitTransaction;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const http_1 = __importDefault(require("http"));
const msgpack_1 = require("@msgpack/msgpack");
function getInternalToken() {
    try {
        const tokenPath = path_1.default.join(os_1.default.homedir(), '.nyxora', 'auth', 'runtime.token');
        if (fs_1.default.existsSync(tokenPath)) {
            return fs_1.default.readFileSync(tokenPath, 'utf8').trim();
        }
    }
    catch { }
    return undefined;
}
// Cross-platform IPC: check for Unix socket on Linux/Mac, use TCP on Windows
const IS_WINDOWS = process.platform === 'win32';
function getPolicyOptions(path_, method, token, extraHeaders) {
    const POLICY_SOCKET = '/tmp/nyxora-policy.sock';
    const headers = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(extraHeaders || {})
    };
    // On Linux/Mac, prefer Unix socket if available (faster IPC)
    if (!IS_WINDOWS && fs_1.default.existsSync(POLICY_SOCKET)) {
        return { socketPath: POLICY_SOCKET, path: path_, method, headers };
    }
    // Fallback: TCP (always used on Windows)
    return { host: '127.0.0.1', port: parseInt(process.env.POLICY_PORT || '3001', 10), path: path_, method, headers };
}
async function getAddress() {
    const token = getInternalToken();
    return new Promise((resolve, reject) => {
        const options = getPolicyOptions('/address', 'GET', token);
        const req = http_1.default.request(options, (res) => {
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
                }
                catch (e) {
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
async function submitTransaction(txPayload) {
    const token = getInternalToken();
    if (txPayload.details) {
        const expiresAt = txPayload.details.expiresAt || txPayload.details.rawQuote?.expiresAt;
        if (expiresAt && Date.now() > expiresAt) {
            throw new Error(`Quote Expired. Market prices may have changed. Please ask the agent to generate a new swap/bridge quote.`);
        }
    }
    if (txPayload.autoApprove) {
        txPayload.details = txPayload.details || {};
        // ROOT FIX: Force amountWei in payload to prevent Policy Engine misinterpretation
        txPayload.details.amountWei = txPayload.details.amountWei || txPayload.details.valueWei || "0";
        const amountWei = txPayload.details.amountWei;
        const secret = getInternalToken() || '';
        txPayload.internalSignature = crypto_1.default.createHmac('sha256', secret).update(txPayload.chainName + amountWei).digest('hex');
    }
    return new Promise((resolve, reject) => {
        const sanitizedPayload = JSON.parse(JSON.stringify(txPayload, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        const payloadBuffer = (0, msgpack_1.encode)(sanitizedPayload);
        const options = getPolicyOptions('/request-tx', 'POST', token, {
            'Content-Type': 'application/msgpack',
            'Content-Length': payloadBuffer.length
        });
        const req = http_1.default.request(options, (res) => {
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
                }
                catch (e) {
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
