import { Bot } from 'grammy';
const bot = new Bot('dummy');
try {
  await bot.api.raw.sendRichMessage({ chat_id: 1, rich_message: { markdown: 'test' } });
} catch (e) {
  console.log('Error caught:', e.name, e.message);
}
