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
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedChains = void 0;
exports.getPublicClient = getPublicClient;
exports.getWalletClient = getWalletClient;
exports.getAddress = getAddress;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
exports.supportedChains = {
    ethereum: chains_1.mainnet,
    base: chains_1.base,
    bsc: chains_1.bsc,
    arbitrum: chains_1.arbitrum,
    optimism: chains_1.optimism,
};
function getPublicClient(chainName) {
    const chain = exports.supportedChains[chainName];
    if (!chain)
        throw new Error(`Unsupported chain: ${chainName}`);
    return (0, viem_1.createPublicClient)({
        chain,
        transport: (0, viem_1.http)(), // Falls back to public RPC, can be customized with process.env
    });
}
function getWalletClient(chainName) {
    const chain = exports.supportedChains[chainName];
    if (!chain)
        throw new Error(`Unsupported chain: ${chainName}`);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey)
        throw new Error('PRIVATE_KEY is not set in .env');
    const account = (0, accounts_1.privateKeyToAccount)(privateKey);
    return (0, viem_1.createWalletClient)({
        account,
        chain,
        transport: (0, viem_1.http)(),
    });
}
function getAddress() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey)
        throw new Error('PRIVATE_KEY is not set in .env');
    return (0, accounts_1.privateKeyToAccount)(privateKey).address;
}
//# sourceMappingURL=config.js.map