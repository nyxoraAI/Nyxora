"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedChains = void 0;
exports.getPublicClient = getPublicClient;
exports.getAddress = getAddress;
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const parser_1 = require("../config/parser");
exports.supportedChains = {
    ethereum: chains_1.mainnet,
    base: chains_1.base,
    bsc: chains_1.bsc,
    arbitrum: chains_1.arbitrum,
    optimism: chains_1.optimism,
    sepolia: chains_1.sepolia,
};
function getPublicClient(chainName) {
    const chain = exports.supportedChains[chainName];
    if (!chain)
        throw new Error(`Unsupported chain: ${chainName}`);
    const config = (0, parser_1.loadConfig)();
    const rpcUrl = config.web3?.rpc_urls?.[chainName];
    // @ts-ignore
    return (0, viem_1.createPublicClient)({
        chain,
        transport: (0, viem_1.http)(rpcUrl),
    });
}
// Fetch address from Policy API which proxies to Signer
async function getAddress() {
    const token = process.env.INTERNAL_AUTH_TOKEN;
    try {
        const res = await fetch('http://127.0.0.1:3001/address', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok)
            throw new Error('Vault is locked or unavailable');
        const data = await res.json();
        return data.address;
    }
    catch (err) {
        throw new Error(`Failed to fetch address: ${err.message}`);
    }
}
