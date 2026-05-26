import { ChainName } from '../config';
export declare function getBalance(chainName: ChainName, address?: `0x${string}`): Promise<string>;
export declare const getBalanceToolDefinition: {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                chainName: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                address: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
};
//# sourceMappingURL=getBalance.d.ts.map