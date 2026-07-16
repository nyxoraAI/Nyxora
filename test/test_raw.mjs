import { Bot, Context } from 'grammy';
const bot = new Bot('dummy');
bot.on('message', (ctx) => {
  console.log('ctx.api.raw exists:', !!ctx.api.raw);
});
