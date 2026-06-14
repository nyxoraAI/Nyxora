import { Telegraf, Markup } from 'telegraf';
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

let globalBotInstance: Telegraf | null = null;

export function formatToTelegramHTML(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  // Match italic * avoiding bullet points at the start of a line
  html = html.replace(/(?<!^|\n)\*(?!\s)(.*?)(?<!\s)\*/g, '<i>$1</i>');
  html = html.replace(/_(.*?)_/g, '<i>$1</i>');
  
  // Convert code blocks and inline code
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Strip <thought> and <think> blocks completely for user-friendly output
  html = html.replace(/&lt;thought&gt;[\s\S]*?&lt;\/thought&gt;\n?/g, '');
  html = html.replace(/<thought>[\s\S]*?<\/thought>\n?/g, '');
  html = html.replace(/&lt;think&gt;[\s\S]*?&lt;\/think&gt;\n?/g, '');
  html = html.replace(/<think>[\s\S]*?<\/think>\n?/g, '');
  
  // Transform Markdown Tables to <pre> monospaced blocks so they don't break on mobile
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
    const bot = new Telegraf(token);
    globalBotInstance = bot;
    
    // Pairing state variables
    const isPaired = !!config.integrations?.telegram?.authorized_chat_id;
    let generatedPin = '';
    let pinExpiry = 0;

    if (!isPaired) {
      generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      pinExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes TTL
      
      console.log(pc.yellow('\n==================================================='));
      console.log(pc.yellow('🔐 TELEGRAM BOT AUTHORIZATION REQUIRED'));
      console.log(pc.yellow('==================================================='));
      console.log('Your Telegram Bot is currently locked for security.');
      console.log('Open your Telegram app, and send the following command to your bot:\n');
      console.log(pc.cyan(`  /auth ${generatedPin}\n`));
      console.log(pc.gray('(This OTP code will expire in 5 minutes)\n'));
      console.log('⏳ Waiting for incoming message...');
    }

    // Security Middleware (OTP & Authorization)
    bot.use(async (ctx, next) => {
      const currentConfig = loadConfig();
      const authId = currentConfig.integrations?.telegram?.authorized_chat_id;
      
      if (authId) {
        // Paired mode: Reject unauthorized users silently
        if (ctx.chat?.id !== authId) {
          return;
        }
        return next();
      }

      // Pairing mode: Listen for /auth command
      if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text || '';
        if (text.startsWith('/auth ')) {
          const pin = text.split(' ')[1];
          if (Date.now() > pinExpiry) {
            await ctx.reply('❌ The pairing PIN has expired. Please restart the CLI to generate a new one.');
            return;
          }
          if (pin === generatedPin) {
            // Success
            if (!currentConfig.integrations) currentConfig.integrations = {};
            if (!currentConfig.integrations.telegram) currentConfig.integrations.telegram = { enabled: true, bot_token: token };
            
            currentConfig.integrations.telegram.authorized_chat_id = ctx.chat?.id;
            saveConfig(currentConfig);
            
            await ctx.reply('✅ Authorization Successful! Nyxora Agent will now only obey your commands. Connection secured.');
            console.log(pc.green(`\n[Telegram] Successfully paired with Chat ID: ${ctx.chat?.id}`));
            return; // Done parsing auth, ignore this specific message for further logic
          } else {
            await ctx.reply('❌ Incorrect PIN.');
            return;
          }
        }
      }
      
      // If not paired and not an auth command, silently drop
      return;
    });

    bot.command('clear', async (ctx) => {
      logger.clear(ctx.chat?.id.toString());
      await ctx.reply('✅ AI memory has been cleared. Let\\'s start a new chat!');
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return; // Ignore other commands

      console.log(`[Telegram] Received from ${ctx.from?.first_name || 'User'}: ${text}`);
      
      // Send typing action
      await ctx.sendChatAction('typing');

      try {
        let progressMsgId: number | null = null;
        const onProgress = async (progressText: string) => {
          try {
            if (!progressMsgId) {
              const sent = await ctx.reply(`<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
              progressMsgId = sent.message_id;
            } else {
              await ctx.telegram.editMessageText(ctx.chat.id, progressMsgId, undefined, `<i>${progressText.replace(/_/g, '')}</i>`, { parse_mode: 'HTML' });
            }
          } catch (e) {}
        };

        const response = await processUserInput(text, 'user', onProgress, ctx.chat?.id.toString());

        if (progressMsgId) {
          await ctx.telegram.deleteMessage(ctx.chat.id, progressMsgId).catch(() => {});
        }

        const pendingTxs = txManager.getPending();
        const recentPendingTxs = pendingTxs.filter(tx => Date.now() - tx.createdAt < 120000);
        
        if (recentPendingTxs.length > 0) {
          const keyboard = recentPendingTxs.map(tx => [
            Markup.button.callback(`✅ Approve ${tx.type}`, `approve_${tx.id}`),
            Markup.button.callback(`❌ Reject`, `reject_${tx.id}`)
          ]);
          
          await ctx.reply(formatToTelegramHTML(response), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(keyboard)
          });
          return;
        }

        await ctx.reply(formatToTelegramHTML(response), { parse_mode: 'HTML' });
      } catch (error: any) {
        console.error('[Telegram] Error processing message:', error);
        await ctx.reply('❌ Sorry, I encountered an error while processing your message.');
      }
    });

    // Handle callbacks
    bot.action(/^approve_(.+)$/, async (ctx) => {
      const txId = ctx.match[1];
      const tx = txManager.getTransaction(txId);

      if (!tx || tx.status !== 'pending') {
        await ctx.answerCbQuery('Transaction not found or already processed.', { show_alert: true });
        return;
      }

      await ctx.answerCbQuery('Processing transaction...');
      await ctx.reply(`⏳ Processing transaction ${txId}...`);
      
      // Remove inline keyboard immediately
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});

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

    bot.action(/^reject_(.+)$/, async (ctx) => {
      const txId = ctx.match[1];
      txManager.updateStatus(txId, 'rejected');
      processUserInput(`Transaction ${txId} was REJECTED via Telegram. CRITICAL: DO NOT retry or recreate this transaction. Acknowledge this cancellation to the user and stop.`, 'system', undefined, ctx.chat?.id.toString()).catch(() => {});
      
      await ctx.answerCbQuery('Transaction cancelled.');
      await ctx.reply(`❌ Transaction cancelled.`);
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    });

    bot.catch((err) => {
      console.error('[Telegram] Telegraf error:', err);
    });

    bot.launch().catch(err => {
      console.error('[Telegram] Connection failed (likely blocked by ISP or timeout):', err.message);
    });
    
    if (isPaired) {
      console.log('🤖 Telegram Bot is running and securely listening for your messages...');
    }
    
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

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
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`✅ Approve Claim`, `claim_${withdrawalId}`)]
        ])
      };
    }
    await globalBotInstance.telegram.sendMessage(chatId, formatToTelegramHTML(message), extraParams);
  } catch (error) {
    console.error('[Telegram] Failed to send push notification:', error);
  }
}
