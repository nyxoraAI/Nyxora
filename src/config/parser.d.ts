export interface OpenWebConfig {
    agent: {
        name: string;
        default_chain: string;
    };
    llm: {
        provider: 'openai' | 'anthropic' | 'ollama';
        model: string;
        temperature: number;
    };
    memory: {
        type: string;
        path: string;
    };
}
export declare function loadConfig(): OpenWebConfig;
//# sourceMappingURL=parser.d.ts.map