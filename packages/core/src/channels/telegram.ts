import { Bot, InlineKeyboard, InputFile } from 'grammy';
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
    
  html = html.replace(/&lt;(think|thought|thinking|reasoning|analysis|reflection)&gt;[\s\S]*?&lt;\/\1&gt;\n?/gi, '');
  html = html.replace(/<(think|thought|thinking|reasoning|analysis|reflection)>[\s\S]*?<\/\1>\n?/gi, '');
  html = html.replace(/^\s*(?:\*\*)?(?:think|thought|thinking|reasoning|analysis|reflection)(?:\*\*)?\s*?\n[\s\S]*?\n\n/gi, '');

  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
  html = html.replace(/\*\*(.*?)\*\*/g, (match, p1) => {
    if (p1.includes('<pre>') || p1.includes('<code>')) return match;
    return `<b>${p1}</b>`;
  });
  
  html = html.replace(/(?<!^|\n)\*(?!\s)(.*?)(?<!\s)\*/g, (match, p1) => {
    if (p1.includes('<b>') || p1.includes('</b>') || p1.includes('<pre>') || p1.includes('<code>')) return match;
    return `<i>${p1}</i>`;
  });
  
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
      logger.clear(`telegram_${ctx.chat?.id}`);
      await ctx.reply("✅ AI memory has been cleared. Let's start a new chat!");
    });

    bot.command('reasoning', async (ctx) => {
      const text = ctx.message?.text || '';
      const parts = text.split(' ');
      if (parts.length < 2) {
        await ctx.reply("ℹ️ Usage: `/reasoning [high|medium|low|none]`", { parse_mode: 'Markdown' });
        return;
      }
      const effort = parts[1].toLowerCase();
      if (!['high', 'medium', 'low', 'none'].includes(effort)) {
        await ctx.reply("❌ Invalid reasoning effort. Use: high, medium, low, or none.");
        return;
      }
      const config = loadConfig();
      if (!config.llm) config.llm = {} as any;
      config.llm.reasoning_effort = effort as any;
      saveConfig(config);
      await ctx.reply(`✅ Reasoning effort set to: **${effort.toUpperCase()}**`, { parse_mode: 'Markdown' });
    });

    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;

      console.log(`[Telegram] Received from ${ctx.from?.first_name || 'User'}: ${text}`);
      await ctx.replyWithChatAction('typing');

      let isDrafting = false; // Kept for compatibility if used elsewhere

      // Keep sending 'typing' action every 5 seconds while processing
      const typingInterval = setInterval(() => {
        ctx.replyWithChatAction('typing').catch(() => {});
      }, 5000);

      const onChunk = async (chunk: string) => {
        // Disabled streaming on Telegram as requested by user.
        // It will only show 'typing...' and then send the final message.
      };

      const onProgress = async (msg: string) => {
        // Disabled streaming on Telegram.
      };

      try {
        const response = await processUserInputStream(
          text, onChunk, onProgress, `telegram_${ctx.chat?.id}`
        );
        clearInterval(typingInterval);

        // Finalize by sending the permanent message (which replaces the draft)
        let replyMarkup: any = undefined;
        if (/Reply \*\*Yes\*\*/i.test(response) && /\*\*No\*\* to cancel/i.test(response)) {
          replyMarkup = new InlineKeyboard()
            .text('✅ Approve', 'tx_approve')
            .text('❌ Reject', 'tx_reject');
        }

        await ctx.reply(
          formatToTelegramHTML(response),
          { parse_mode: 'HTML', reply_markup: replyMarkup, reply_parameters: { message_id: ctx.message.message_id } }
        ).catch((e) => {
          console.error("[Telegram] CRITICAL: ctx.reply failed in text handler:", e.message);
        });
      } catch (error: any) {
        clearInterval(typingInterval);
        console.error('[Telegram] Error processing message:', error);
        await ctx.reply(
          '❌ Sorry, I encountered an error while processing your message.',
          { reply_parameters: { message_id: ctx.message.message_id } }
        ).catch(() => {});
      }
    });

    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      if (data === 'tx_approve' || data === 'tx_reject') {
        await ctx.answerCallbackQuery().catch(() => {});
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        
        const simulatedText = data === 'tx_approve' ? 'yes' : 'no';
        console.log(`[Telegram] User clicked ${simulatedText.toUpperCase()} via Inline Keyboard`);
        
        if (!ctx.chat) return;
        await ctx.replyWithChatAction('typing');
        
        const draft_id = Math.floor(Math.random() * 100000000) + 1;
        let buffer = '';
        let lastDraftAt = 0;
        let isDrafting = false;
        
        const typingInterval = setInterval(() => {
          ctx.replyWithChatAction('typing').catch(() => {});
        }, 5000);
        
        const onChunk = async (chunk: string) => {
          // Disabled streaming on Telegram.
        };

        const onProgress = async (msg: string) => {
          // Disabled streaming on Telegram.
        };

        try {
          const response = await processUserInputStream(simulatedText, onChunk, onProgress, `telegram_${ctx.chat.id}`);
          clearInterval(typingInterval);
          let replyMarkup: any = undefined;
          if (/Reply \*\*Yes\*\*/i.test(response) && /\*\*No\*\* to cancel/i.test(response)) {
            replyMarkup = new InlineKeyboard().text('✅ Approve', 'tx_approve').text('❌ Reject', 'tx_reject');
          }
          await ctx.reply(formatToTelegramHTML(response), { parse_mode: 'HTML', reply_markup: replyMarkup }).catch((e) => {
             console.error("[Telegram] CRITICAL: ctx.reply failed in callback:", e.message);
          });
        } catch (error) {
          clearInterval(typingInterval);
          await ctx.reply('❌ Sorry, I encountered an error.', {}).catch(() => {});
        }
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
              const sent = await ctx.reply(`<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML', reply_parameters: { message_id: ctx.message?.message_id } as any });
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

        await ctx.reply(formatToTelegramHTML(response), { parse_mode: 'HTML', reply_parameters: { message_id: ctx.message?.message_id } as any });
      } catch (error: any) {
        console.error('[Telegram] Error processing document:', error);
        await ctx.reply('❌ Sorry, I failed to download or analyze the document.', { reply_parameters: { message_id: ctx.message?.message_id } as any });
      }
    });

    bot.on('message:photo', async (ctx) => {
      const photos = ctx.message.photo;
      // Photos array contains multiple resolutions; the last one is the largest.
      const photo = photos[photos.length - 1];
      const caption = ctx.message.caption || 'Tolong analisa gambar ini.';
      console.log(`[Telegram] Received photo from ${ctx.from?.first_name || 'User'}`);
      
      await ctx.replyWithChatAction('typing');
      
      try {
        const file = await ctx.api.getFile(photo.file_id);
        const fileLink = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        
        const imgDir = path.join(os.homedir(), '.nyxora', 'images');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        
        const ext = path.extname(file.file_path || '') || '.jpg';
        const localFilePath = path.join(imgDir, `telegram_photo_${Date.now()}${ext}`);
        
        const res = await fetch(fileLink);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(localFilePath, Buffer.from(buffer));
        
        const prompt = `${caption}\\n[System Alert: An image was attached at path: ${localFilePath}. You MUST emit a standard JSON tool call for 'analyze_local_image'. DO NOT use <tool_code> or Python!]`;
        
        let progressMsgId: number | null = null;
        const onProgress = async (progressText: string) => {
          try {
            if (!progressMsgId) {
              const sent = await ctx.reply(`<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML', reply_parameters: { message_id: ctx.message?.message_id } as any });
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

        await ctx.reply(formatToTelegramHTML(response), { parse_mode: 'HTML', reply_parameters: { message_id: ctx.message?.message_id } as any });
      } catch (error: any) {
        console.error('[Telegram] Error processing photo:', error);
        await ctx.reply('❌ Sorry, I failed to download or analyze the photo.', { reply_parameters: { message_id: ctx.message?.message_id } as any });
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

export async function sendTelegramDocument(absolutePath: string): Promise<string> {
  const config = loadConfig();
  const chatId = config.integrations?.telegram?.authorized_chat_id;
  if (!chatId) return `[Error] No authorized Telegram chat ID found. Please pair Telegram first.`;
  if (!globalBotInstance) return `[Error] Telegram bot is not initialized.`;
  if (!fs.existsSync(absolutePath)) return `[Error] File not found: ${absolutePath}`;
  
  try {
    const file = new InputFile(absolutePath);
    await globalBotInstance.api.sendDocument(chatId, file);
    return `Success! File has been uploaded directly to the Telegram chat.`;
  } catch (err: any) {
    return `[Error] Failed to upload document to Telegram: ${err.message}`;
  }
}
