import { ChannelAdapter } from './ChannelManager';

export class WhatsappAdapter implements ChannelAdapter {
    id: string = 'whatsapp';
    name: string = 'WhatsApp';
    private sock: any;

    async initialize(): Promise<void> {
        console.log(`[WhatsApp] Initializing...`);
    }

    async start(): Promise<void> {
        // Lazy require — baileys is a runtime-optional dependency not bundled with Nyxora.
        // Install separately if you want WhatsApp support: npm install baileys
        // Using require() instead of import() to bypass TypeScript type resolution for optional packages.
        let makeWASocket: any, useMultiFileAuthState: any, DisconnectReason: any;
        try {
            // @ts-ignore — intentional: baileys is optional and may not be installed
            const baileys = require('baileys');
            makeWASocket = baileys.default || baileys;
            useMultiFileAuthState = baileys.useMultiFileAuthState;
            DisconnectReason = baileys.DisconnectReason;
        } catch (e: any) {
            console.error('[WhatsApp] Cannot start: missing optional dependency "baileys".');
            console.error('[WhatsApp] Install it with: npm install baileys');
            return;
        }

        const { state, saveCreds } = await useMultiFileAuthState('whatsapp_auth_info');
        
        // Create a silent logger to prevent Baileys from spamming the terminal with raw JSON
        const pino = require('pino');
        const logger = pino({ level: 'silent' });

        this.sock = makeWASocket.default ? makeWASocket.default({
            auth: state,
            logger
        }) : makeWASocket({
            auth: state,
            logger
        });

        this.sock.ev.on('creds.update', saveCreds);

        let lastQr = '';
        let lastQrTime = 0;
        this.sock.ev.on('connection.update', (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && qr !== lastQr) {
                const now = Date.now();
                if (now - lastQrTime > 15000) {
                    lastQr = qr;
                    lastQrTime = now;
                    console.log('\n======================================================');
                    console.log('📱 SCAN THIS QR CODE WITH WHATSAPP (Refreshed)');
                    console.log('======================================================\n');
                    require('qrcode-terminal').generate(qr, { small: true });
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    console.log('[WhatsApp] Connection closed. Reconnecting...');
                    this.start();
                } else {
                    console.log('[WhatsApp] Connection closed. You are logged out.');
                }
            } else if (connection === 'open') {
                console.log('[WhatsApp] Connected!');
            }
        });

        this.sock.ev.on('messages.upsert', async (m: any) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            const remoteJid = msg.key.remoteJid;

            if (text && remoteJid) {
                console.log(`[WhatsApp] Received from ${remoteJid}: ${text}`);
                // const response = await processUserInput(text, 'user', undefined, remoteJid);
                // if (response) {
                //     await this.sendMessage(remoteJid, response);
                // }
            }
        });
    }

    async stop(): Promise<void> {
        if (this.sock) {
            this.sock.logout();
        }
    }

    async sendMessage(chatId: string, message: string): Promise<void> {
        if (this.sock) {
            await this.sock.sendMessage(chatId, { text: message });
        }
    }

    async setupCredentials(config: any): Promise<void> {
        console.log(`\n======================================================`);
        console.log(`📱 [WhatsApp Setup]`);
        console.log(`Nyxora uses Baileys for WhatsApp Web integration.`);
        console.log(`A QR Code will automatically be generated in this terminal`);
        console.log(`the first time you run 'nyxora start'.`);
        console.log(`Please scan it with your WhatsApp Mobile App to pair the agent.`);
        console.log(`======================================================\n`);
    }
}

export const adapter = new WhatsappAdapter();
