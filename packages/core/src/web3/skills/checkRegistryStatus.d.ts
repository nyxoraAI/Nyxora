/**
 * Checks the on-chain registry status of the AI agent on Base Sepolia.
 * Returns true if the agent is active or if the registry check is gracefully skipped.
 * Returns false if the agent is explicitly deactivated (Kill Switch triggered).
 */
export declare function checkRegistryStatus(): Promise<{
    isActive: boolean;
    reason?: string;
}>;
export declare const checkRegistryStatusToolDefinition: {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {};
            required: never[];
        };
    };
};
