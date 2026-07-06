import { App } from '@slack/bolt';
import { ChannelAdapter } from './ChannelManager';
// import { processUserInput } from '../agent/reasoning'; // To be wired up

export class SlackAdapter implements ChannelAdapter {
    id: string = 'slack';
    name: string = 'Slack';
    private app: any;

    async initialize(): Promise<void> {
        console.log(`[Slack] Initializing...`);
    }

    async start(): Promise<void> {
        const config = require('../config/parser').loadConfig();
        const token = config.integrations?.slack?.bot_token;
        const appToken = config.integrations?.slack?.app_token;

        if (!token || !appToken) {
            console.error('[Slack] Missing bot_token or app_token in config.yaml. Please set them up.');
            return;
        }

        this.app = new App({
            token: token,
            appToken: appToken,
            socketMode: true,
        });

        this.app.message(async ({ message, say }: any) => {
            // filter out bot messages or subtype messages
            if (message.bot_id || message.subtype) return;

            const text = message.text;
            const channel = message.channel;

            if (text) {
                console.log(`[Slack] Received from ${channel}: ${text}`);
                // const response = await processUserInput(text, 'user', undefined, channel);
                // if (response) {
                //     await say(response);
                // }
            }
        });

        await this.app.start();
        console.log('[Slack] Connected via Socket Mode!');
    }

    async stop(): Promise<void> {
        if (this.app) {
            await this.app.stop();
        }
    }

    async sendMessage(chatId: string, message: string): Promise<void> {
        if (this.app) {
            await this.app.client.chat.postMessage({
                channel: chatId,
                text: message
            });
        }
    }

    async setupCredentials(config: any): Promise<void> {
        console.log(`\n======================================================`);
        console.log(`🏢 [Slack Setup]`);
        console.log(`Please go to https://api.slack.com/apps`);
        console.log(`1. Create an App from Scratch.`);
        console.log(`2. Go to 'Socket Mode' and enable it (Generate an App-Level Token starting with xapp-).`);
        console.log(`3. Go to 'OAuth & Permissions', add 'chat:write' and 'channels:history' scopes.`);
        console.log(`4. Go to 'Event Subscriptions', enable it, and subscribe to 'message.channels' event.`);
        console.log(`5. Install App to Workspace and get the Bot User OAuth Token (starting with xoxb-).`);
        console.log(`\nAdd them to your config.yaml under:`);
        console.log(`integrations:`);
        console.log(`  slack:`);
        console.log(`    bot_token: "xoxb-..."`);
        console.log(`    app_token: "xapp-..."`);
        console.log(`======================================================\n`);
    }
}

export const adapter = new SlackAdapter();
