export interface ChannelAdapter {
    id: string;
    name: string;
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    sendMessage(chatId: string, message: string): Promise<void>;
    setupCredentials?(config: any): Promise<void>;
}

export class ChannelManager {
    private adapters: Map<string, ChannelAdapter> = new Map();

    register(adapter: ChannelAdapter) {
        this.adapters.set(adapter.id, adapter);
    }

    getAdapter(id: string) {
        return this.adapters.get(id);
    }

    getAllAdapters() {
        return Array.from(this.adapters.values());
    }

    async startAll(activeChannels: string[]) {
        for (const channelId of activeChannels) {
            const adapter = this.adapters.get(channelId);
            if (adapter) {
                console.log(`[ChannelManager] Starting ${adapter.name}...`);
                try {
                    await adapter.initialize();
                    await adapter.start();
                    console.log(`[ChannelManager] ${adapter.name} started successfully.`);
                } catch (error: any) {
                    console.error(`[ChannelManager] Failed to start ${adapter.name}: ${error.message}`);
                }
            } else {
                console.warn(`[ChannelManager] Channel adapter '${channelId}' is enabled in config but not registered.`);
            }
        }
    }
}

export const channelManager = new ChannelManager();
