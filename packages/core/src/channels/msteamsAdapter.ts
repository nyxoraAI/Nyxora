import express from 'express';
import { ChannelAdapter } from './ChannelManager';
// import { processUserInput } from '../agent/reasoning';

export class MsteamsAdapter implements ChannelAdapter {
    id: string = 'msteams';
    name: string = 'Msteams';
    private server: any;

    async initialize(): Promise<void> {
        console.log(`[${this.name}] Initializing...`);
    }

    async start(): Promise<void> {
        const config = require('../config/parser').loadConfig();
        const port = config.integrations?.msteams?.port || 3006;
        
        const app = express();
        app.use(express.json());
        
        app.post('/webhook', async (req, res) => {
            const body = req.body;
            console.log(`[${this.name}] Webhook event received:`, body);
            // Process event here
            res.status(200).send('OK');
        });

        this.server = app.listen(port, () => {
            console.log(`[${this.name}] Webhook listener running on port ${port}`);
        });
    }

    async stop(): Promise<void> {
        if (this.server) {
            this.server.close();
        }
    }

    async sendMessage(chatId: string, message: string): Promise<void> {
        console.log(`[${this.name}] Sending message to ${chatId}: ${message}`);
        // Implementation depends on the specific REST API
    }

    async setupCredentials(config: any): Promise<void> {
        console.log(`[Setup] Configure ${this.name} in config.yaml under integrations.msteams`);
    }
}
export const adapter = new MsteamsAdapter();
