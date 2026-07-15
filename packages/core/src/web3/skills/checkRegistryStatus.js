"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRegistryStatusToolDefinition = void 0;
exports.checkRegistryStatus = checkRegistryStatus;
const config_1 = require("../config");
const config_2 = require("../config");
const parser_1 = require("../../config/parser");
const REGISTRY_ADDRESS = '0x19F00Ac093B6b0a6Ae2f669dF698384ba79E37Be';
const REGISTRY_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "registeredAgents",
        "outputs": [
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "controllerWallet",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "isActive",
                "type": "bool"
            },
            {
                "internalType": "uint256",
                "name": "registeredAt",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];
/**
 * Checks the on-chain registry status of the AI agent on Base Sepolia.
 * Returns true if the agent is active or if the registry check is gracefully skipped.
 * Returns false if the agent is explicitly deactivated (Kill Switch triggered).
 */
async function checkRegistryStatus() {
    try {
        const config = (0, parser_1.loadConfig)();
        const userAddress = await (0, config_2.getAddress)();
        // Always use base_sepolia for the registry check
        const publicClient = (0, config_1.getPublicClient)('base_sepolia');
        const result = await publicClient.readContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: 'registeredAgents',
            args: [userAddress]
        });
        const [name, controllerWallet, isActive, registeredAt] = result;
        // If registeredAt is 0, it means the agent hasn't been registered yet.
        // For hackathon purposes, if it's not registered, we can either block it or allow it.
        // Let's allow unregistered agents to function, but if registered, strictly follow `isActive`.
        if (registeredAt === 0n) {
            return { isActive: true, reason: 'Agent is not registered on-chain yet.' };
        }
        if (!isActive) {
            return { isActive: false, reason: 'Agent is deactivated on Base Sepolia Registry.' };
        }
        return { isActive: true, reason: 'Agent is active and verified.' };
    }
    catch (error) {
        console.error('[Registry Check Error]', error);
        // If the network is down, we fallback to true to prevent bricking the system,
        // but in a strict production environment, we might fail closed.
        return { isActive: true, reason: 'Registry check skipped due to network error.' };
    }
}
exports.checkRegistryStatusToolDefinition = {
    type: "function",
    function: {
        name: "check_registry_status",
        description: "Checks the On-Chain Kill Switch Registry status of the agent on Base Sepolia. Use this ONLY when the user explicitly asks about the agent's registration status, kill switch, or if it is registered.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};
