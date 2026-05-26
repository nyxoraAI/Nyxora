export interface MemoryEntry {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: any[];
}
export declare class Logger {
    private logFilePath;
    private memory;
    constructor();
    private loadMemory;
    private saveMemory;
    getHistory(): MemoryEntry[];
    addEntry(entry: MemoryEntry): void;
    clear(): void;
}
//# sourceMappingURL=logger.d.ts.map