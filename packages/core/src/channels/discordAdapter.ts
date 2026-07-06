import { Client, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import { processUserInput } from '../agent/reasoning';
import { loadConfig } from '../config/parser';

let discordClient: Client | null = null;

export function startDiscordBot() {
  const config = loadConfig();
  const token = config.integrations?.discord?.bot_token;

  if (!token || !config.integrations?.discord?.enabled) {
    console.log('[Discord] Bot is disabled or missing bot_token in config.yaml.');
    return;
  }

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.once('ready', () => {
    console.log(`🤖 Discord Bot is online and logged in as ${discordClient?.user?.tag}`);
  });

  discordClient.on('messageCreate', async (message: Message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the bot is mentioned
    if (discordClient?.user && message.mentions.has(discordClient.user)) {
      // Strip the mention from the message
      const prompt = message.content.replace(new RegExp(`<@!?${discordClient.user.id}>`, 'g'), '').trim();
      
      if (!prompt) return;

      console.log(`[Discord] Received mention from ${message.author.username} in #${(message.channel as TextChannel).name}: ${prompt}`);

      // Send initial thinking indicator
      let replyMessage: Message | null = null;
      try {
        replyMessage = await message.reply('⏳ *Thinking...*');
      } catch (err) {
        console.error('[Discord] Failed to send initial reply', err);
        return;
      }

      const onProgress = async (progressText: string) => {
        try {
          if (replyMessage) {
            await replyMessage.edit(`*${progressText}*`);
          }
        } catch (err) {
          // Ignore minor edit errors
        }
      };

      try {
        const sessionId = `discord_${message.author.id}`;
        const response = await processUserInput(prompt, 'user', onProgress, sessionId);
        
        // Clean up thought blocks if any
        let finalResponse = response.replace(/<thought>[\s\S]*?<\/thought>\n?/g, '').replace(/<think>[\s\S]*?<\/think>\n?/g, '');
        
        if (replyMessage) {
            // Discord has a 2000 character limit per message
            if (finalResponse.length > 2000) {
                await replyMessage.edit(finalResponse.slice(0, 1997) + '...');
            } else {
                await replyMessage.edit(finalResponse);
            }
        }
      } catch (error: any) {
        console.error('[Discord] Error processing message:', error);
        if (replyMessage) {
          await replyMessage.edit('❌ Sorry, I encountered an error while processing your request.');
        }
      }
    }
  });

  discordClient.login(token).catch(err => {
    console.error('[Discord] Failed to login:', err);
  });
}
