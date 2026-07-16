import { Bot } from 'grammy';
import fs from 'fs';
import yaml from 'js-yaml';
const config = yaml.load(fs.readFileSync('/home/perasyudha/.nyxora/nyxora.yml', 'utf8'));
const bot = new Bot(config.channels.telegram.bot_token);
try {
  await bot.api.raw.sendRichMessage({ chat_id: config.channels.telegram.admin_id, rich_message: { markdown: 'test' } });
} catch (e) {
  console.log('Error caught:', e.name, e.message, e.description, e.error_code);
}
