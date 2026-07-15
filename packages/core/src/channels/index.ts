import { channelManager } from './ChannelManager';

// IMPORTANT: All channel adapters with optional/external dependencies MUST be
// loaded lazily here (via dynamic import) to prevent startup crashes when the
// required npm package is not installed on a global user's system.
//
// Only adapters that have ALL their dependencies listed in package.json can use
// a top-level static import. Everything else must use dynamic import.
//
// Pattern: Try to import → if module missing, log a warning and skip.

async function tryRegisterAdapter(channelId: string, adapterFile: string) {
  try {
    const mod = await import(`./${adapterFile}`);
    const adapter = mod.adapter || mod.default;
    if (adapter) {
      channelManager.register(adapter);
    }
  } catch (e: any) {
    if (e.code === 'MODULE_NOT_FOUND') {
      // Extract the missing package name from the error message
      const match = e.message?.match(/Cannot find module '([^']+)'/);
      const missingPkg = match ? match[1] : 'unknown';
      console.warn(`[ChannelManager] Skipping '${channelId}' adapter — optional dependency missing: ${missingPkg}`);
      console.warn(`[ChannelManager]   Install it with: npm install -g ${missingPkg}`);
    } else {
      console.error(`[ChannelManager] Failed to load '${channelId}' adapter:`, e.message);
    }
  }
}

export async function registerAllAdapters(): Promise<void> {
  await Promise.all([
    tryRegisterAdapter('whatsapp', 'whatsappAdapter'),
    tryRegisterAdapter('slack', 'slackAdapter'),
    tryRegisterAdapter('line', 'lineAdapter'),
    tryRegisterAdapter('msteams', 'msteamsAdapter'),
    tryRegisterAdapter('mattermost', 'mattermostAdapter'),
    tryRegisterAdapter('matrix', 'matrixAdapter'),
    tryRegisterAdapter('googlechat', 'googlechatAdapter'),
    tryRegisterAdapter('zalo', 'zaloAdapter'),
    tryRegisterAdapter('twitch', 'twitchAdapter'),
    tryRegisterAdapter('imessage', 'imessageAdapter'),
    tryRegisterAdapter('sms', 'smsAdapter'),
    tryRegisterAdapter('voicecall', 'voicecallAdapter'),
    tryRegisterAdapter('irc', 'ircAdapter'),
    tryRegisterAdapter('qqbot', 'qqbotAdapter'),
    tryRegisterAdapter('nostr', 'nostrAdapter'),
    tryRegisterAdapter('synologychat', 'synologychatAdapter'),
    tryRegisterAdapter('nextcloudtalk', 'nextcloudtalkAdapter'),
  ]);
}

// Note: telegram and discord adapters are registered directly in server.ts
// because they are core supported channels with all deps in package.json.

export { channelManager };
