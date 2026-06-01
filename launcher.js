"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const INTERNAL_AUTH_TOKEN = crypto_1.default.randomBytes(64).toString('hex');
console.log(`[Launcher] Generated Internal Auth Token: ${INTERNAL_AUTH_TOKEN.substring(0, 8)}...`);
const env = {
    ...process.env,
    INTERNAL_AUTH_TOKEN,
    SIGNER_SOCKET_PATH: '/tmp/nyxora-signer.sock'
};
const spawnService = (name, command, args, env, inheritStdio = false) => {
    const child = (0, child_process_1.spawn)(command, args, { env, stdio: inheritStdio ? 'inherit' : 'pipe' });
    if (!inheritStdio) {
        child.stdout?.on('data', (data) => {
            process.stdout.write(`[${name}] ${data}`);
        });
        child.stderr?.on('data', (data) => {
            process.stderr.write(`[${name}] ERROR: ${data}`);
        });
    }
    child.on('close', (code) => {
        console.log(`[${name}] Exited with code ${code}`);
    });
    return child;
};
console.log('[Launcher] Starting Monorepo Services...');
const socketPath = env.SIGNER_SOCKET_PATH;
if (fs_1.default.existsSync(socketPath)) {
    console.log(`[Launcher] Removing stale unix socket at ${socketPath}`);
    fs_1.default.unlinkSync(socketPath);
}
const signerPath = path_1.default.join(__dirname, 'packages/signer/src/server.ts');
const signer = spawnService('Signer', 'npx', ['ts-node', '-T', signerPath], env);
setTimeout(() => {
    const policyPath = path_1.default.join(__dirname, 'packages/policy/src/server.ts');
    const policy = spawnService('Policy', 'npx', ['ts-node', '-T', policyPath], env);
    setTimeout(() => {
        const corePath = path_1.default.join(__dirname, 'packages/core/src/gateway/cli.ts');
        const args = process.argv.slice(2);
        const core = spawnService('Core', 'npx', ['ts-node', '-T', corePath, ...args], env, true);
    }, 1000);
}, 1000);
