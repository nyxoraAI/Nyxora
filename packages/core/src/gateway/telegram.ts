import { Bot, InlineKeyboard } from 'grammy';
import { run } from '@grammyjs/runner';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { processUserInput, logger } from '../agent/reasoning';
import { loadConfig, saveConfig } from '../config/parser';
import { txManager } from '../agent/transactionManager';
import { executeTransfer } from '../web3/skills/transfer';
import { executeSwap } from '../web3/skills/swapToken';
import { executeBridge } from '../web3/skills/bridgeToken';
import { executeMintNft } from '../web3/skills/mintNft';
import { executeCustomTx } from '../web3/skills/customTx';

import { executeApprove, executeAaveSupply, executeVaultDeposit, executeUniv3Mint } from '../web3/skills/executeDefi';
import { executeRevokeApproval } from '../web3/skills/revokeApprovals';
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

      try {
        let progressMsgId: number | null = null;
        const onProgress = async (progressText: string) => {
          try {
            if (!progressMsgId) {
              const sent = await ctx.reply(`<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
              progressMsgId = sent.message_id;
            } else {
              await ctx.api.editMessageText(ctx.chat.id, progressMsgId, `<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
            }
          } catch (e) {}
        };

        const response = await processUserInput(text, 'user', onProgress, ctx.chat?.id.toString());

        if (progressMsgId) {
          await ctx.api.deleteMessage(ctx.chat.id, progressMsgId).catch(() => {});
        }

        const pendingTxs = txManager.getPending();
        const recentPendingTxs = pendingTxs.filter((tx: any) => Date.now() - tx.createdAt < 120000);
        
        if (recentPendingTxs.length > 0) {
          const keyboard = new InlineKeyboard();
          recentPendingTxs.forEach((tx: any) => {
            keyboard.text(`✅ Approve ${tx.type}`, `approve_${tx.id}`).text(`❌ Reject`, `reject_${tx.id}`).row();
          });
          
          await ctx.reply(formatToTelegramHTML(response), {
            parse_mode: 'HTML',
            reply_markup: keyboard
          });
          return;
        }

        await ctx.reply(formatToTelegramHTML(response), { parse_mode: 'HTML' });
      } catch (error: any) {
        console.error('[Telegram] Error processing message:', error);
        await ctx.reply('❌ Sorry, I encountered an error while processing your message.');
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
        
        const prompt = `Tolong analisis dokumen ini: ${localFilePath}\n\n${caption}`;
        
        let progressMsgId: number | null = null;
        const onProgress = async (progressText: string) => {
          try {
            if (!progressMsgId) {
              const sent = await ctx.reply(`<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
              progressMsgId = sent.message_id;
            } else {
              await ctx.api.editMessageText(ctx.chat.id, progressMsgId, `<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
            }
          } catch (e) {}
        };

        const response = await processUserInput(prompt, 'user', onProgress, ctx.chat?.id.toString());

        if (progressMsgId) {
          await ctx.api.deleteMessage(ctx.chat.id, progressMsgId).catch(() => {});
        }

        await ctx.reply(formatToTelegramHTML(response), { parse_mode: 'HTML' });
      } catch (error: any) {
        console.error('[Telegram] Error processing document:', error);
        await ctx.reply('❌ Sorry, I failed to download or analyze the document.');
      }
    });

    bot.callbackQuery(/^approve_(.+)$/, async (ctx) => {
      const txId = ctx.match[1];
      const tx = txManager.getTransaction(txId);

      if (!tx || tx.status !== 'pending') {
        await ctx.answerCallbackQuery({ text: 'Transaction not found or already processed.', show_alert: true });
        return;
      }

      await ctx.answerCallbackQuery('Processing transaction...');
      await ctx.reply(`⏳ Processing transaction ${txId}...`);
      
      await ctx.api.editMessageReplyMarkup(ctx.chat!.id, ctx.msg!.message_id, { reply_markup: { inline_keyboard: [] } }).catch(() => {});

      try {
        let result = '';
        if (tx.type === 'transfer') {
          result = await executeTransfer(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'swap') {
          result = await executeSwap(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'bridge') {
          result = await executeBridge(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'mint') {
          result = await executeMintNft(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'custom') {
          result = await executeCustomTx(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'approve') {
          result = await executeApprove(tx.chainName as any, tx.details);
        } else if (tx.type === 'aaveSupply') {
          result = await executeAaveSupply(tx.chainName as any, tx.details);
        } else if (tx.type === 'vaultDeposit') {
          result = await executeVaultDeposit(tx.chainName as any, tx.details);
        } else if (tx.type === 'univ3Mint') {
          result = await executeUniv3Mint(tx.chainName as any, tx.details);
        } else if (tx.type === 'revokeApproval') {
          result = await executeRevokeApproval(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'limit_order') {
          const success = logger.activateLimitOrder(tx.details.orderId);
          if (success) {
            result = `Limit Order ${tx.details.orderId} is now ACTIVE. The Event-Driven Engine is monitoring the market.`;
          } else {
            throw new Error(`Failed to activate Limit Order. ID not found in database.`);
          }
        }
        
        txManager.updateStatus(txId, 'executed', result);
        
        const prettyMsg = formatTransactionSuccess(tx, result);
        await ctx.reply(formatToTelegramHTML(`✅ **Transaction processed: Success**\n\n${prettyMsg}`), { parse_mode: 'HTML' });
        
        processUserInput(`Transaction ${txId} was APPROVED via Telegram. Result: ${result}`, 'system', undefined, ctx.chat?.id.toString()).catch(() => {});
      } catch (err: any) {
        txManager.updateStatus(txId, 'failed', err.message);
        const prettyError = formatTransactionError(tx, err.message);
        await ctx.reply(prettyError);
        processUserInput(`Transaction ${txId} FAILED via Telegram. Error: ${err.message}`, 'system', undefined, ctx.chat?.id.toString()).catch(() => {});
      }
    });

    bot.callbackQuery(/^reject_(.+)$/, async (ctx) => {
      const txId = ctx.match[1];
      txManager.updateStatus(txId, 'rejected');
      processUserInput(`Transaction ${txId} was REJECTED via Telegram. CRITICAL: DO NOT retry or recreate this transaction. Acknowledge this cancellation to the user and stop.`, 'system', undefined, ctx.chat?.id.toString()).catch(() => {});
      
      await ctx.answerCallbackQuery('Transaction cancelled.');
      await ctx.reply(`❌ Transaction cancelled.`);
      await ctx.api.editMessageReplyMarkup(ctx.chat!.id, ctx.msg!.message_id, { reply_markup: { inline_keyboard: [] } }).catch(() => {});
    });

    bot.catch((err) => {
      console.error('[Telegram] Grammy error:', err);
    });

    runnerInstance = run(bot);
    
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
