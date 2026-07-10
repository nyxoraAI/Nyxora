export declare function encryptDataSync(text: string): string;
export declare function decryptDataSync(encryptedText: string): string;
export declare function loadRpcConfig(): Record<string, string | string[]>;
export declare function saveRpcConfig(rpcUrls: Record<string, string | string[]>): void;
export declare function loadApiKeys(): Promise<Record<string, string>>;
export declare function saveApiKeys(newKeys: Record<string, string>): Promise<void>;
export interface NyxoraConfig {
    agent: {
        name: string;
        description: string;
        default_chain: string;
        default_router?: string;
        default_slippage?: number | "auto";
        log_level?: 'info' | 'debug';
        base_fiat?: string;
        python_path?: string;
    };
    llm: {
        provider: string;
        model: string;
        temperature: number;
        reasoning_effort?: 'low' | 'medium' | 'high' | 'none';
        api_keys?: string[];
        credentials?: any;
        base_url?: string;
    };
    web_search?: {
        provider: 'tavily' | 'brave' | 'duckduckgo' | 'mesh' | 'serpapi';
        enabled: boolean;
    };
    credentials?: {
        openai_key?: string;
        gemini_key?: string;
        anthropic_key?: string;
        openrouter_key?: string;
        '9router_key'?: string;
        custom_provider_key?: string;
        tavily_key?: string;
        brave_key?: string;
        serpapi_key?: string;
        [key: string]: string | undefined;
    };
    memory: {
        type: string;
        path: string;
    };
    web3?: {
        rpc_urls?: Record<string, string | string[]>;
        explorer_api_key?: string;
    };
    integrations?: {
        telegram?: {
            enabled: boolean;
            bot_token?: string;
            authorized_chat_id?: number;
        };
        discord?: {
            enabled: boolean;
            bot_token?: string;
            client_id?: string;
        };
    };
    security?: {
        dashboard_password?: string;
    };
    skills?: {
        web3: string[];
        os: string[];
    };
    channels?: {
        active: string[];
    };
}
export declare function loadConfig(): NyxoraConfig;
export declare function saveConfig(newConfig: NyxoraConfig): void;
export interface PolicyConfig {
    max_usd_per_tx?: number;
    whitelist_only?: boolean;
    require_approval?: boolean;
    auto_approve_limit_usd?: number;
    custom_llm_rules?: string[];
}
export declare function loadPolicyConfig(): PolicyConfig;
