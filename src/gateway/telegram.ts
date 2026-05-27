import TelegramBot from 'node-telegram-bot-api';
import { processUserInput } from '../agent/reasoning';
import { loadConfig } from '../config/parser';
import { txManager } from '../agent/transactionManager';
import { executeTransfer } from '../web3/skills/transfer';
import { executeSwap } from '../web3/skills/swapToken';

export function startTelegramBot() {
  const config = loadConfig();
  const token = config.integrations?.telegram?.bot_token;

  
  if (!token) {
    console.log('[Telegram] No TELEGRAM_BOT_TOKEN found in config.yaml. Bot is disabled.');
    return;
  }

  try {
    const bot = new TelegramBot(token, { polling: true });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text) return;

      // Log incoming message
      console.log(`[Telegram] Received from ${msg.from?.first_name}: ${text}`);

      // Send typing action to Telegram
      bot.sendChatAction(chatId, 'typing');

      try {
        // Feed the message to the AI agent
        const response = await processUserInput(text);
        
        // Send the AI's response back to Telegram
        
        // Check for newly created pending transactions
        const pendingTxs = txManager.getPending();
        if (pendingTxs.length > 0) {
          const latestTx = pendingTxs[pendingTxs.length - 1];
          // If the transaction was created within the last 2 minutes, show the inline keyboard
          if (Date.now() - latestTx.createdAt < 120000) {
            bot.sendMessage(chatId, response, {
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Approve', callback_data: `approve_${latestTx.id}` },
                  { text: '❌ Reject', callback_data: `reject_${latestTx.id}` }
                ]]
              }
            });
            return;
          }
        }
        
        bot.sendMessage(chatId, response);
      } catch (error: any) {
        console.error('[Telegram] Error processing message:', error);
        bot.sendMessage(chatId, '❌ Sorry, I encountered an error while processing your message.');
      }
    });

    bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      if (!chatId || !query.data) return;

      const [action, txId] = query.data.split('_');
      const tx = txManager.getTransaction(txId);

      if (!tx || tx.status !== 'pending') {
        bot.answerCallbackQuery(query.id, { text: 'Transaction not found or already processed.', show_alert: true });
        return;
      }

      if (action === 'approve') {
        bot.answerCallbackQuery(query.id, { text: 'Processing transaction...' });
        bot.sendMessage(chatId, `⏳ Processing transaction ${txId}...`);
        try {
          let result = '';
          if (tx.type === 'transfer') {
            result = await executeTransfer(tx.chainName as any, tx.details.toAddress, tx.details.amountEth);
          } else if (tx.type === 'swap') {
            result = await executeSwap(tx.chainName, tx.details.fromToken, tx.details.toToken, tx.details.amount);
          }
          txManager.updateStatus(txId, 'executed', result);
          processUserInput(`[SYSTEM]: Transaction ${txId} was APPROVED via Telegram. Result: ${result}`);
          bot.sendMessage(chatId, `✅ Transaction successful!\n${result}`);
        } catch (err: any) {
          txManager.updateStatus(txId, 'failed', err.message);
          processUserInput(`[SYSTEM]: Transaction ${txId} FAILED via Telegram. Error: ${err.message}`);
          bot.sendMessage(chatId, `❌ Transaction failed!\n${err.message}`);
        }
      } else if (action === 'reject') {
        txManager.updateStatus(txId, 'rejected');
        processUserInput(`[SYSTEM]: Transaction ${txId} was REJECTED via Telegram.`);
        bot.answerCallbackQuery(query.id, { text: 'Transaction cancelled.' });
        bot.sendMessage(chatId, `❌ Transaction ${txId} has been cancelled.`);
      }
      
      // Remove inline keyboard
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message?.message_id });
    });

    bot.on('polling_error', (error) => {
      console.error('[Telegram] Polling error:', error);
    });

    console.log('🤖 Telegram Bot is running and listening for messages...');
  } catch (error) {
    console.error('[Telegram] Failed to initialize bot:', error);
  }
}
