import { Telegraf, Markup } from 'telegraf';
import { processUserInput, logger } from '../agent/reasoning';
import { loadConfig, saveConfig } from '../config/parser';
import { txManager } from '../agent/transactionManager';
import { executeTransfer } from '../web3/skills/transfer';
import { executeSwap } from '../web3/skills/swapToken';
import { executeBridge } from '../web3/skills/bridgeToken';
import { executeMintNft } from '../web3/skills/mintNft';
import { executeCustomTx } from '../web3/skills/customTx';
import { formatTransactionSuccess, formatTransactionError } from '../utils/formatter';
import pc from 'picocolors';

export function startTelegramBot() {
  const config = loadConfig();
  const token = config.integrations?.telegram?.bot_token;

  if (!token) {
    console.log('[Telegram] No TELEGRAM_BOT_TOKEN found in config.yaml. Bot is disabled.');
    return;
  }

  try {
    const bot = new Telegraf(token);
    
    // Pairing state variables
    const isPaired = !!config.integrations?.telegram?.authorized_chat_id;
    let generatedPin = '';
    let pinExpiry = 0;

    if (!isPaired) {
      generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      pinExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes TTL
      
      console.log(pc.yellow('\n==================================================='));
      console.log(pc.yellow('🔐 OTORISASI BOT TELEGRAM DIBUTUHKAN'));
      console.log(pc.yellow('==================================================='));
      console.log('Bot Telegram Anda saat ini terkunci demi keamanan.');
      console.log('Buka Telegram Anda, dan kirimkan perintah berikut ke bot Anda:\n');
      console.log(pc.cyan(`  /auth ${generatedPin}\n`));
      console.log(pc.gray('(Kode OTP ini akan kedaluwarsa dalam 5 menit)\n'));
      console.log('⏳ Menunggu pesan masuk...');
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
            
            await ctx.reply('✅ Otorisasi Berhasil! Agen Nyxora kini hanya akan mematuhi perintah Anda. Koneksi diamankan.');
            console.log(pc.green(`\n[Telegram] Successfully paired with Chat ID: ${ctx.chat?.id}`));
            return; // Done parsing auth, ignore this specific message for further logic
          } else {
            await ctx.reply('❌ PIN salah.');
            return;
          }
        }
      }
      
      // If not paired and not an auth command, silently drop
      return;
    });

    bot.command('clear', async (ctx) => {
      logger.clear();
      await ctx.reply('✅ Memori AI telah dihapus. Mari kita mulai obrolan baru!');
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
              const sent = await ctx.reply(progressText, { parse_mode: 'Markdown' });
              progressMsgId = sent.message_id;
            } else {
              await ctx.telegram.editMessageText(ctx.chat.id, progressMsgId, undefined, progressText, { parse_mode: 'Markdown' });
            }
          } catch (e) {}
        };

        const response = await processUserInput(text, 'user', onProgress);

        if (progressMsgId) {
          await ctx.telegram.deleteMessage(ctx.chat.id, progressMsgId).catch(() => {});
        }

        const pendingTxs = txManager.getPending();
        if (pendingTxs.length > 0) {
          const latestTx = pendingTxs[pendingTxs.length - 1];
          if (Date.now() - latestTx.createdAt < 120000) {
            await ctx.reply(response, Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Approve', `approve_${latestTx.id}`),
                Markup.button.callback('❌ Reject', `reject_${latestTx.id}`)
              ]
            ]));
            return;
          }
        }

        await ctx.reply(response);
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
          result = await executeTransfer(tx.chainName as any, tx.details);
        } else if (tx.type === 'swap') {
          result = await executeSwap(tx.chainName as any, tx.details);
        } else if (tx.type === 'bridge') {
          result = await executeBridge(tx.chainName as any, tx.details);
        } else if (tx.type === 'mint') {
          result = await executeMintNft(tx.chainName as any, tx.details);
        } else if (tx.type === 'custom') {
          result = await executeCustomTx(tx.chainName as any, tx.details);
        }
        
        txManager.updateStatus(txId, 'executed', result);
        const prettyMsg = formatTransactionSuccess(tx, result);
        await ctx.reply(`✅ Transaction processed:\n\n${prettyMsg}`);
        
        logger.addEntry({ role: 'assistant', content: `✅ Transaction processed:\n\n${prettyMsg}` });
        logger.addEntry({ role: 'tool', name: tx.type === 'swap' ? 'swap_token' : 'transfer_native', content: result });
        
        processUserInput(`Transaction ${txId} was APPROVED via Telegram. Result: ${result}`, 'system').catch(() => {});
      } catch (err: any) {
        txManager.updateStatus(txId, 'failed', err.message);
        const prettyError = formatTransactionError(tx, err.message);
        await ctx.reply(prettyError);
        processUserInput(`Transaction ${txId} FAILED via Telegram. Error: ${err.message}`, 'system').catch(() => {});
      }
    });

    bot.action(/^reject_(.+)$/, async (ctx) => {
      const txId = ctx.match[1];
      txManager.updateStatus(txId, 'rejected');
      processUserInput(`Transaction ${txId} was REJECTED via Telegram. Acknowledge this briefly.`, 'system').catch(() => {});
      
      await ctx.answerCbQuery('Transaction cancelled.');
      await ctx.reply(`❌ Transaction cancelled.`);
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    });

    bot.catch((err) => {
      console.error('[Telegram] Telegraf error:', err);
    });

    bot.launch();
    
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
