import { Bot } from 'grammy';
import { loadApiKeys } from './packages/core/dist/config/parser.js';

const keys = loadApiKeys();
const bot = new Bot(keys.telegramBotToken);
try {
  await bot.api.raw.sendRichMessage({ chat_id: process.env.TELEGRAM_ADMIN_ID || 12345678, rich_message: { markdown: 'test' } });
} catch (e) {
  console.log('Error caught:', e.name, e.message, e.description, e.error_code);
}
