import TelegramBot from 'node-telegram-bot-api';
import { processUserInput } from '../agent/reasoning';

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.log('[Telegram] No TELEGRAM_BOT_TOKEN found in .env. Bot is disabled.');
    return;
  }

  try {
    const bot = new TelegramBot(token, { polling: true });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text) return;

      // Log incoming message
      console.log(`[Telegram] Received from ${msg.from?.first_name}: ${text}`);

      // Send typing action to Telegram
      bot.sendChatAction(chatId, 'typing');

      try {
        // Feed the message to the AI agent
        const response = await processUserInput(text);
        
        // Send the AI's response back to Telegram
        bot.sendMessage(chatId, response);
      } catch (error: any) {
        console.error('[Telegram] Error processing message:', error);
        bot.sendMessage(chatId, '❌ Maaf, saya mengalami gangguan saat memproses pesan Anda.');
      }
    });

    bot.on('polling_error', (error) => {
      console.error('[Telegram] Polling error:', error);
    });

    console.log('🤖 Telegram Bot is running and listening for messages...');
  } catch (error) {
    console.error('[Telegram] Failed to initialize bot:', error);
  }
}
