import { Bot, InlineKeyboard } from 'grammy';
import { run } from '@grammyjs/runner';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { processUserInput, processUserInputStream, logger } from '../agent/reasoning';
import { loadConfig, saveConfig } from '../config/parser';
import { txManager } from '../agent/transactionManager';
import { executeTransfer } from '../web3/skills/transfer';
import { executeSwap } from '../web3/skills/swapToken';
import { executeBridge } from '../web3/skills/bridgeToken';
import { executeMintNft } from '../web3/skills/mintNft';
import { executeCustomTx } from '../web3/skills/customTx';

import { executeApprove, executeAaveSupply, executeVaultDeposit, executeUniv3Mint } from '../web3/skills/executeDefi';
import { executeRevokeApproval } from '../web3/skills/revokeApprovals';
import { checkRegistryStatus } from '../web3/skills/checkRegistryStatus';
import { formatTransactionSuccess, formatTransactionError } from '../utils/formatter';
import pc from 'picocolors';
import fs from 'fs';
import path from 'path';
import os from 'os';

let globalBotInstance: Bot | null = null;
let runnerInstance: any = null;

export function formatToTelegramHTML(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  html = html.replace(/(?<!^|\n)\*(?!\s)(.*?)(?<!\s)\*/g, '<i>$1</i>');
  html = html.replace(/_(.*?)_/g, '<i>$1</i>');
  
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  html = html.replace(/&lt;thought&gt;[\s\S]*?&lt;\/thought&gt;\n?/g, '');
  html = html.replace(/<thought>[\s\S]*?<\/thought>\n?/g, '');
  html = html.replace(/&lt;think&gt;[\s\S]*?&lt;\/think&gt;\n?/g, '');
  html = html.replace(/<think>[\s\S]*?<\/think>\n?/g, '');
  
  const tableRegex = /(?:\|.*\|(?:\n|$))+/g;
  html = html.replace(tableRegex, (match) => {
     return `<pre>${match.trim()}</pre>\n`;
  });

  return html;
}

export function startTelegramBot() {
  const config = loadConfig();
  const token = config.integrations?.telegram?.bot_token;

  if (!token) {
    console.log('[Telegram] No TELEGRAM_BOT_TOKEN found in config.yaml. Bot is disabled.');
    return;
  }

  try {
    const bot = new Bot(token);
    globalBotInstance = bot;
    
    const throttler = apiThrottler();
    bot.api.config.use(throttler);
    
    bot.api.config.use(async (prev, method, payload, signal) => {
      try {
        return await prev(method, payload, signal);
      } catch (err: any) {
        if (method === 'getUpdates' && err.message?.includes('ETIMEDOUT')) {
          console.log(pc.yellow('[Telegram] API connection lost (Timeout). Retrying automatically...'));
        } else if (method === 'getUpdates') {
          console.log(pc.yellow(`[Telegram] Failed to fetch updates: ${err.message}`));
        }
        throw err; // Rethrow so the runner can gracefully backoff and retry
      }
    });
    
    const isPaired = !!config.integrations?.telegram?.authorized_chat_id;
    let generatedPin = '';
    let pinExpiry = 0;

    if (!isPaired) {
      generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      pinExpiry = Date.now() + 5 * 60 * 1000;
      
      console.log(pc.yellow('\n==================================================='));
      console.log(pc.yellow('🔐 TELEGRAM BOT AUTHORIZATION REQUIRED'));
      console.log(pc.yellow('==================================================='));
      console.log('Your Telegram Bot is currently locked for security.');
      console.log('Open your Telegram app, and send the following command to your bot:\n');
      console.log(pc.cyan(`  /auth ${generatedPin}\n`));
      console.log(pc.gray('(This OTP code will expire in 5 minutes)\n'));
      console.log('⏳ Waiting for incoming message...');
    }

    bot.use(async (ctx, next) => {
      const currentConfig = loadConfig();
      const authId = currentConfig.integrations?.telegram?.authorized_chat_id;
      
      if (authId) {
        if (ctx.chat?.id !== authId) {
          return;
        }
        return next();
      }

      if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text || '';
        if (text.startsWith('/auth ')) {
          const pin = text.split(' ')[1];
          if (Date.now() > pinExpiry) {
            await ctx.reply('❌ The pairing PIN has expired. Please restart the CLI to generate a new one.');
            return;
          }
          if (pin === generatedPin) {
            if (!currentConfig.integrations) currentConfig.integrations = {};
            if (!currentConfig.integrations.telegram) currentConfig.integrations.telegram = { enabled: true, bot_token: token };
            
            currentConfig.integrations.telegram.authorized_chat_id = ctx.chat?.id;
            saveConfig(currentConfig);
            
            await ctx.reply('✅ Authorization Successful! Nyxora Agent will now only obey your commands. Connection secured.');
            console.log(pc.green(`\n[Telegram] Successfully paired with Chat ID: ${ctx.chat?.id}`));
            return;
          } else {
            await ctx.reply('❌ Incorrect PIN.');
            return;
          }
        }
      }
      return;
    });

    bot.command('clear', async (ctx) => {
      logger.clear(ctx.chat?.id.toString());
      await ctx.reply("✅ AI memory has been cleared. Let's start a new chat!");
    });

    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;

      console.log(`[Telegram] Received from ${ctx.from?.first_name || 'User'}: ${text}`);
      await ctx.replyWithChatAction('typing');

      // No need for a placeholder message anymore! We use ephemeral drafts.
      const draft_id = Math.floor(Math.random() * 100000000) + 1;
      let buffer = '';
      let lastDraftAt = 0;
      let isDrafting = false;
      const THROTTLE_MS = 100; // Native drafts can be streamed incredibly fast

      const onChunk = async (chunk: string) => {
        buffer += chunk;
        const now = Date.now();
        if (!isDrafting && now - lastDraftAt >= THROTTLE_MS) {
          isDrafting = true;
          try {
            await ctx.api.sendMessageDraft(
              ctx.chat.id, draft_id,
              formatToTelegramHTML(buffer),
              { parse_mode: 'HTML' } as any
            );
          } catch {}
          lastDraftAt = Date.now();
          isDrafting = false;
        }
      };

      const onProgress = async (msg: string) => {
        if (!isDrafting) {
          isDrafting = true;
          try {
            await ctx.api.sendMessageDraft(
              ctx.chat.id, draft_id,
              `<i>${msg.replace(/_/g, '')}</i>`,
              { parse_mode: 'HTML' } as any
            );
          } catch {}
          isDrafting = false;
        }
      };

      try {
        const response = await processUserInputStream(
          text, onChunk, onProgress, `telegram_${ctx.chat?.id}`
        );

        // Finalize by sending the permanent message (which replaces the draft)
        await ctx.reply(
          formatToTelegramHTML(response),
          { parse_mode: 'HTML' }
        ).catch(() => {});
      } catch (error: any) {
        console.error('[Telegram] Error processing message:', error);
        await ctx.reply(
          '❌ Sorry, I encountered an error while processing your message.',
          {}
        ).catch(() => {});
      }
    });


    bot.on('message:document', async (ctx) => {
      const doc = ctx.message.document;
      const caption = ctx.message.caption || '';
      console.log(`[Telegram] Received document from ${ctx.from?.first_name || 'User'}: ${doc.file_name}`);
      
      await ctx.replyWithChatAction('typing');
      
      try {
        const file = await ctx.api.getFile(doc.file_id);
        const fileLink = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        
        const docsDir = path.join(os.homedir(), '.nyxora', 'docs');
        if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
        
        const safeName = (doc.file_name || 'telegram_doc').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const localFilePath = path.join(docsDir, `${Date.now()}-${safeName}`);
        
        const res = await fetch(fileLink);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(localFilePath, Buffer.from(buffer));
        
        const prompt = `Please analyze this document: ${localFilePath}\n\n${caption}`;
        
        let progressMsgId: number | null = null;
        const onProgress = async (progressText: string) => {
          try {
            if (!progressMsgId) {
              const sent = await ctx.reply(`<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
              progressMsgId = sent.message_id;
            } else {
              await ctx.api.editMessageText(ctx.chat.id, progressMsgId, `<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
            }
          } catch {}
        };

        const response = await processUserInput(prompt, 'user', onProgress, `telegram_${ctx.chat?.id}`);

        if (progressMsgId) {
          await ctx.api.deleteMessage(ctx.chat.id, progressMsgId).catch(() => {});
        }

        await ctx.reply(formatToTelegramHTML(response), { parse_mode: 'HTML' });
      } catch (error: any) {
        console.error('[Telegram] Error processing document:', error);
        await ctx.reply('❌ Sorry, I failed to download or analyze the document.');
      }
    });

    // Transaction approval and rejection are now handled conversationally via the LLM and the confirm_pending_tx tool.

    bot.catch((err) => {
      console.error('[Telegram] Grammy error:', err);
    });

    runnerInstance = run(bot, {
      runner: { silent: true }
    });
    
    if (isPaired) {
      console.log('🤖 Telegram Bot is running and securely listening for your messages...');
    }
    
    process.once('SIGINT', () => { runnerInstance?.stop() });
    process.once('SIGTERM', () => { runnerInstance?.stop() });

  } catch (error) {
    console.error('[Telegram] Failed to initialize bot:', error);
  }
}

export async function sendPushNotification(chatId: string | number, message: string, withdrawalId?: string) {
  if (!globalBotInstance) return;
  try {
    let extraParams: any = { parse_mode: 'HTML' };
    if (withdrawalId) {
      extraParams = {
        ...extraParams,
        reply_markup: new InlineKeyboard().text(`✅ Approve Claim`, `claim_${withdrawalId}`)
      };
    }
    await globalBotInstance.api.sendMessage(chatId, formatToTelegramHTML(message), extraParams);
  } catch (error) {
    console.error('[Telegram] Failed to send push notification:', error);
  }
}
