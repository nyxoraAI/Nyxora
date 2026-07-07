import express from 'express';
import { ChannelAdapter } from './ChannelManager';
// import { processUserInput } from '../agent/reasoning'; // To be wired up


export class LineAdapter implements ChannelAdapter {
    id: string = 'line';
    name: string = 'LINE';
    private client: any;
    private server: any;


    async initialize(): Promise<void> {
        console.log(`[LINE] Initializing...`);
    }

    async start(): Promise<void> {
        const config = require('../config/parser').loadConfig();
        const channelAccessToken = config.integrations?.line?.channel_access_token;
        const channelSecret = config.integrations?.line?.channel_secret;
        const port = config.integrations?.line?.port || 3005;

        if (!channelAccessToken || !channelSecret) {
            console.error('[LINE] Missing channel_access_token or channel_secret in config.yaml.');
            return;
        }

        let line: any;
        try {
            line = await import('@line/bot-sdk');
        } catch (e: any) {
            console.error('[LINE] Cannot start: missing optional dependency "@line/bot-sdk".');
            console.error('[LINE] Install it with: npm install -g @line/bot-sdk');
            return;
        }

        const lineConfig = { channelAccessToken, channelSecret };
        this.client = new line.messagingApi.MessagingApiClient({ channelAccessToken });

        const app = express();
        
        // Webhook route
        app.post('/webhook', line.middleware(lineConfig), async (req: any, res: any) => {
            Promise.all(req.body.events.map(this.handleEvent.bind(this)))
                .then(() => res.status(200).end())
                .catch((err) => {
                    console.error('[LINE] Webhook error:', err);
                    res.status(500).end();
                });
        });

        this.server = app.listen(port, () => {
            console.log(`[LINE] Connected! Webhook listener running on port ${port}. Please map this to your LINE developer console.`);
        });
    }

    async handleEvent(event: any) {
        if (event.type !== 'message' || event.message.type !== 'text') {
            return null;
        }

        const text = event.message.text;
        const replyToken = event.replyToken;
        const userId = event.source.userId;

        if (text && userId) {
            console.log(`[LINE] Received from ${userId}: ${text}`);
            // const response = await processUserInput(text, 'user', undefined, userId);
            // if (response && this.client) {
            //     await this.client.replyMessage({
            //         replyToken: replyToken,
            //         messages: [{ type: 'text', text: response }],
            //     });
            // }
        }
    }

    async stop(): Promise<void> {
        if (this.server) {
            this.server.close();
        }
    }

    async sendMessage(chatId: string, message: string): Promise<void> {
        if (this.client) {
            await this.client.pushMessage({
                to: chatId,
                messages: [{ type: 'text', text: message }]
            });
        }
    }

    async setupCredentials(config: any): Promise<void> {
        console.log(`\n======================================================`);
        console.log(`💬 [LINE Setup]`);
        console.log(`Please go to https://developers.line.biz/console/`);
        console.log(`1. Create a Messaging API channel.`);
        console.log(`2. Issue a Channel Access Token (long-lived).`);
        console.log(`3. Get the Channel Secret.`);
        console.log(`4. Set up a Webhook URL (e.g., via ngrok) pointing to your Nyxora IP:3005/webhook.`);
        console.log(`\nAdd them to your config.yaml under:`);
        console.log(`integrations:`);
        console.log(`  line:`);
        console.log(`    channel_access_token: "..."`);
        console.log(`    channel_secret: "..."`);
        console.log(`    port: 3005`);
        console.log(`======================================================\n`);
    }
}

export const adapter = new LineAdapter();
