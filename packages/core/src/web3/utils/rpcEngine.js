"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicClient = getPublicClient;
exports.getWsClient = getWsClient;
const viem_1 = require("viem");
const parser_1 = require("../../config/parser");
const chains_1 = require("./chains");
function getPublicClient(chainName) {
    const chain = chains_1.supportedChains[chainName];
    if (!chain)
        throw new Error(`Unsupported chain: ${chainName}`);
    const config = (0, parser_1.loadConfig)();
    const customRpcRaw = config.web3?.rpc_urls?.[chainName];
    const transports = [];
    if (customRpcRaw) {
        if (Array.isArray(customRpcRaw)) {
            customRpcRaw.forEach(url => {
                if (url.trim())
                    transports.push((0, viem_1.http)(url.trim(), { batch: { batchSize: 100 } }));
            });
        }
        else if (typeof customRpcRaw === 'string' && customRpcRaw.trim()) {
            transports.push((0, viem_1.http)(customRpcRaw.trim(), { batch: { batchSize: 100 } }));
        }
    }
    // Fallback public RPCs (Top tier from Chainlist.org prioritized)
    if (transports.length === 0) {
        if (chainName === 'ethereum') {
            transports.push((0, viem_1.http)('https://rpc.mevblocker.io', { timeout: 5000, batch: { batchSize: 100 } })); // Primary MEV protection
            transports.push((0, viem_1.http)('https://rpc.flashbots.net', { timeout: 5000, batch: { batchSize: 100 } })); // Secondary MEV protection
            transports.push((0, viem_1.http)('https://ethereum-rpc.publicnode.com', { timeout: 5000, batch: { batchSize: 100 } })); // Fallback
        }
        else if (chainName === 'bsc') {
            transports.push((0, viem_1.http)('https://bsc-rpc.publicnode.com', { timeout: 5000, batch: { batchSize: 100 } }));
            transports.push((0, viem_1.http)('https://bsc-dataseed.binance.org', { timeout: 5000, batch: { batchSize: 100 } }));
        }
        else if (chainName === 'base') {
            transports.push((0, viem_1.http)('https://base-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://mainnet.base.org', { timeout: 5000 }));
        }
        else if (chainName === 'arbitrum') {
            transports.push((0, viem_1.http)('https://arbitrum-one-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://arb1.arbitrum.io/rpc', { timeout: 5000 }));
        }
        else if (chainName === 'optimism') {
            transports.push((0, viem_1.http)('https://optimism-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://mainnet.optimism.io', { timeout: 5000 }));
        }
        else if (chainName === 'sepolia') {
            transports.push((0, viem_1.http)('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://rpc.sepolia.org', { timeout: 5000 }));
        }
        else if (chainName === 'polygon') {
            transports.push((0, viem_1.http)('https://polygon-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://polygon.llamarpc.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://polygon-rpc.com', { timeout: 5000 }));
        }
        else if (chainName === 'arbitrum_sepolia') {
            transports.push((0, viem_1.http)('https://arbitrum-sepolia-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://sepolia-rollup.arbitrum.io/rpc', { timeout: 5000 }));
        }
        else if (chainName === 'optimism_sepolia') {
            transports.push((0, viem_1.http)('https://optimism-sepolia-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://sepolia.optimism.io', { timeout: 5000 }));
        }
        else if (chainName === 'base_sepolia') {
            transports.push((0, viem_1.http)('https://base-sepolia-rpc.publicnode.com', { timeout: 5000 }));
            transports.push((0, viem_1.http)('https://sepolia.base.org', { timeout: 5000 }));
        }
    }
    // Always append the default public RPC (like cloudflare) as the last resort
    transports.push((0, viem_1.http)(undefined, { timeout: 5000 }));
    // @ts-ignore
    return (0, viem_1.createPublicClient)({
        chain,
        transport: (0, viem_1.fallback)(transports, { rank: false }),
        batch: {
            multicall: {
                batchSize: 100,
                wait: 16
            }
        }
    });
}
function getWsClient(chainName) {
    const chain = chains_1.supportedChains[chainName];
    if (!chain)
        throw new Error(`Unsupported chain: ${chainName}`);
    const config = (0, parser_1.loadConfig)();
    const customRpcRaw = config.web3?.rpc_urls?.[chainName];
    let wsUrl = '';
    if (customRpcRaw) {
        const urls = Array.isArray(customRpcRaw) ? customRpcRaw : [customRpcRaw];
        const foundWs = urls.find(u => u.trim().startsWith('wss://') || u.trim().startsWith('ws://'));
        if (foundWs)
            wsUrl = foundWs.trim();
    }
    // Fallback to Public WSS if available
    if (!wsUrl) {
        if (chainName === 'ethereum')
            wsUrl = 'wss://ethereum-rpc.publicnode.com';
        else if (chainName === 'bsc')
            wsUrl = 'wss://bsc-rpc.publicnode.com';
        else if (chainName === 'base')
            wsUrl = 'wss://base-rpc.publicnode.com';
        else if (chainName === 'arbitrum')
            wsUrl = 'wss://arbitrum-one-rpc.publicnode.com';
        else if (chainName === 'optimism')
            wsUrl = 'wss://optimism-rpc.publicnode.com';
        else if (chainName === 'sepolia')
            wsUrl = 'wss://ethereum-sepolia-rpc.publicnode.com';
        else if (chainName === 'polygon')
            wsUrl = 'wss://polygon-rpc.publicnode.com';
        else if (chainName === 'arbitrum_sepolia')
            wsUrl = 'wss://arbitrum-sepolia-rpc.publicnode.com';
        else if (chainName === 'optimism_sepolia')
            wsUrl = 'wss://optimism-sepolia-rpc.publicnode.com';
        else if (chainName === 'base_sepolia')
            wsUrl = 'wss://base-sepolia-rpc.publicnode.com';
    }
    // If WSS is totally unavailable, fallback to HTTP polling transparently
    if (!wsUrl) {
        return getPublicClient(chainName);
    }
    // @ts-ignore
    return (0, viem_1.createPublicClient)({
        chain,
        transport: (0, viem_1.fallback)([
            (0, viem_1.webSocket)(wsUrl, {
                retryCount: 5,
                retryDelay: 1000,
                keepAlive: true
            }),
            // WSS Auto-Reconnect Fallback: If WS completely fails, gracefully degrade to HTTP
            (0, viem_1.http)()
        ])
    });
}
