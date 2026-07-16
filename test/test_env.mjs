import { Bot } from 'grammy';
import dotenv from 'dotenv';
dotenv.config({ path: '/home/perasyudha/.nyxora/.env' });

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
try {
  await bot.api.raw.sendRichMessage({ chat_id: process.env.TELEGRAM_ADMIN_ID, rich_message: { markdown: 'test' } });
} catch (e) {
  console.log('Error caught:', e.name, e.message, e.description, e.error_code);
}
