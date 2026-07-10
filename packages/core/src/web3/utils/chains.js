"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_CHAIN_NAMES = exports.supportedChains = void 0;
exports.normalizeChainName = normalizeChainName;
const chains_1 = require("viem/chains");
exports.supportedChains = {
    ethereum: chains_1.mainnet,
    base: chains_1.base,
    bsc: chains_1.bsc,
    arbitrum: chains_1.arbitrum,
    optimism: chains_1.optimism,
    sepolia: chains_1.sepolia,
    polygon: chains_1.polygon,
    base_sepolia: chains_1.baseSepolia,
    arbitrum_sepolia: chains_1.arbitrumSepolia,
    optimism_sepolia: chains_1.optimismSepolia,
};
exports.SUPPORTED_CHAIN_NAMES = Object.keys(exports.supportedChains);
function normalizeChainName(name) {
    let _c = String(name || "").trim().toLowerCase().replace(/\s+/g, '_');
    if (_c.startsWith('arb_'))
        _c = _c.replace('arb_', 'arbitrum_');
    else if (_c === 'arb')
        _c = 'arbitrum';
    else if (_c.startsWith('opt_'))
        _c = _c.replace('opt_', 'optimism_');
    else if (_c === 'opt')
        _c = 'optimism';
    else if (_c === 'matic')
        _c = 'polygon';
    else if (_c === 'eth')
        _c = 'ethereum';
    else if (_c === 'bnb')
        _c = 'bsc';
    return _c;
}
