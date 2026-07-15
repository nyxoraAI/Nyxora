import { Bot } from 'grammy';
// Provide the telegram token manually for test
const token = process.env.TELEGRAM_TOKEN || ''; 
const chatId = process.env.CHAT_ID || '';

async function testDraft() {
  if (!token) return console.error("No token");
  const bot = new Bot(token);
  try {
    const draftId = Math.floor(Math.random() * 100000);
    console.log("Sending draft 1...");
    await (bot.api as any).sendMessageDraft({
      chat_id: chatId,
      draft_id: draftId,
      text: "<i>Thinking...</i>",
      parse_mode: "HTML"
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Sending draft 2...");
    await (bot.api as any).sendMessageDraft({
      chat_id: chatId,
      draft_id: draftId,
      text: "<i>Thinking... hello!</i>",
      parse_mode: "HTML"
    });
    console.log("Draft sent successfully!");
  } catch (e: any) {
    console.error("Draft failed:", e.message);
  }
}

testDraft();
