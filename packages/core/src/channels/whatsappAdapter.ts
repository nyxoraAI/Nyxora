import { ChannelAdapter } from './ChannelManager';
import { processUserInput } from '../agent/reasoning';

export class WhatsappAdapter implements ChannelAdapter {
    id: string = 'whatsapp';
    name: string = 'WhatsApp';
    private sock: any;
    private currentStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
    private qrDataUrl: string | null = null;

    async initialize(): Promise<void> {
        console.log(`[WhatsApp] Initializing...`);
    }

    getStatus() {
        return {
            status: this.currentStatus,
            qrDataUrl: this.qrDataUrl
        };
    }

    async start(): Promise<void> {
        // Lazy require — baileys is a runtime-optional dependency not bundled with Nyxora.
        // Install separately if you want WhatsApp support: npm install @whiskeysockets/baileys
        // Using require() instead of import() to bypass TypeScript type resolution for optional packages.
        let makeWASocket: any, useMultiFileAuthState: any, DisconnectReason: any;
        try {
            // @ts-ignore — intentional: baileys is optional and may not be installed
            const baileys = require('@whiskeysockets/baileys');
            makeWASocket = baileys.default || baileys;
            useMultiFileAuthState = baileys.useMultiFileAuthState;
            DisconnectReason = baileys.DisconnectReason;
        } catch (e: any) {
            console.error('[WhatsApp] Cannot start: missing optional dependency "@whiskeysockets/baileys".');
            console.error('[WhatsApp] Install it with: npm install @whiskeysockets/baileys');
            return;
        }

        const path = require('path');
        const os = require('os');
        const authDir = path.join(os.homedir(), '.nyxora', 'auth', 'whatsapp');

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
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
        this.currentStatus = 'connecting';

        let lastQr = '';
        let lastQrTime = 0;
        this.sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && qr !== lastQr) {
                const now = Date.now();
                if (now - lastQrTime > 15000) {
                    lastQr = qr;
                    lastQrTime = now;
                    try {
                        const QRCode = require('qrcode');
                        this.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 5 });
                        this.currentStatus = 'connecting';
                        console.log('[WhatsApp] New QR code generated. Waiting for scan...');
                    } catch (e) {
                        console.error('[WhatsApp] Failed to generate QR data URL', e);
                    }
                }
            }

            if (connection === 'close') {
                this.currentStatus = 'disconnected';
                this.qrDataUrl = null;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    console.log('[WhatsApp] Connection closed. Reconnecting...');
                    this.start();
                } else {
                    console.log('[WhatsApp] Connection closed. You are logged out.');
                }
            } else if (connection === 'open') {
                this.currentStatus = 'connected';
                this.qrDataUrl = null;
                console.log('[WhatsApp] Connected!');
            }
        });

        const botSentMessageIds = new Set<string>();

        this.sock.ev.on('messages.upsert', async (m: any) => {
            for (const msg of m.messages) {
                if (!msg.message) continue;

                // Debug log to see all incoming message keys
                console.log(`[WhatsApp DEBUG] Key: ${JSON.stringify(msg.key)}, user.id: ${this.sock.user?.id}`);

                // Prevent infinite loop from our own replies
                if (msg.key.id && botSentMessageIds.has(msg.key.id)) continue;

                const remoteJid = msg.key.remoteJid;
                
                // Calculate bot's own JID (stripping device id, e.g. :15)
                const botJid = this.sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
                const isMessageYourself = (remoteJid === botJid || msg.key.remoteJidAlt === botJid);

                // Ignore messages sent by us in OTHER chats (so bot doesn't reply to your friends when you type)
                if (msg.key.fromMe && !isMessageYourself) continue;

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

                if (text && remoteJid) {
                    console.log(`[WhatsApp] Received from ${remoteJid}: ${text}`);
                    // Use a fire-and-forget promise wrapper to avoid blocking the loop
                    processUserInput(text, 'user', undefined, `whatsapp_${remoteJid}`)
                        .then(async (response) => {
                            if (response) {
                                const sentMsg = await this.sendMessage(remoteJid, response);
                                if (sentMsg?.key?.id) {
                                    botSentMessageIds.add(sentMsg.key.id);
                                    if (botSentMessageIds.size > 500) botSentMessageIds.clear(); // anti memory leak
                                }
                            }
                        })
                        .catch(err => console.error(`[WhatsApp] Error processing message:`, err));
                }
            }
        });
    }

    async stop(): Promise<void> {
        if (this.sock) {
            this.sock.logout();
        }
        this.currentStatus = 'disconnected';
        this.qrDataUrl = null;
    }

    async sendMessage(chatId: string, message: string): Promise<any> {
        if (this.sock) {
            return await this.sock.sendMessage(chatId, { text: message });
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
