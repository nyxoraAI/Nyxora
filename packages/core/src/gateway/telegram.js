"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTelegramBot = startTelegramBot;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const reasoning_1 = require("../agent/reasoning");
const parser_1 = require("../config/parser");
const transactionManager_1 = require("../agent/transactionManager");
const transfer_1 = require("../web3/skills/transfer");
const swapToken_1 = require("../web3/skills/swapToken");
const bridgeToken_1 = require("../web3/skills/bridgeToken");
const mintNft_1 = require("../web3/skills/mintNft");
const customTx_1 = require("../web3/skills/customTx");
const formatter_1 = require("../utils/formatter");
function startTelegramBot() {
    const config = (0, parser_1.loadConfig)();
    const token = config.integrations?.telegram?.bot_token;
    if (!token) {
        console.log('[Telegram] No TELEGRAM_BOT_TOKEN found in config.yaml. Bot is disabled.');
        return;
    }
    try {
        const bot = new node_telegram_bot_api_1.default(token, { polling: true });
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            if (!text)
                return;
            if (text === '/clear') {
                reasoning_1.logger.clear();
                bot.sendMessage(chatId, '✅ Memori AI telah dihapus. Mari kita mulai obrolan baru!');
                return;
            }
            // Log incoming message
            console.log(`[Telegram] Received from ${msg.from?.first_name}: ${text}`);
            // Send typing action to Telegram
            bot.sendChatAction(chatId, 'typing');
            try {
                let progressMsgId = null;
                const onProgress = async (progressText) => {
                    try {
                        if (!progressMsgId) {
                            const sent = await bot.sendMessage(chatId, progressText, { parse_mode: 'Markdown' });
                            progressMsgId = sent.message_id;
                        }
                        else {
                            await bot.editMessageText(progressText, { chat_id: chatId, message_id: progressMsgId, parse_mode: 'Markdown' });
                        }
                    }
                    catch (e) { }
                };
                // Feed the message to the AI agent
                const response = await (0, reasoning_1.processUserInput)(text, 'user', onProgress);
                if (progressMsgId) {
                    // Clean up the progress message
                    bot.deleteMessage(chatId, progressMsgId).catch(() => { });
                }
                // Send the AI's response back to Telegram
                // Check for newly created pending transactions
                const pendingTxs = transactionManager_1.txManager.getPending();
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
            }
            catch (error) {
                console.error('[Telegram] Error processing message:', error);
                bot.sendMessage(chatId, '❌ Sorry, I encountered an error while processing your message.');
            }
        });
        bot.on('callback_query', async (query) => {
            const chatId = query.message?.chat.id;
            if (!chatId || !query.data)
                return;
            const [action, txId] = query.data.split('_');
            const tx = transactionManager_1.txManager.getTransaction(txId);
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
                        result = await (0, transfer_1.executeTransfer)(tx.chainName, tx.details);
                    }
                    else if (tx.type === 'swap') {
                        result = await (0, swapToken_1.executeSwap)(tx.chainName, tx.details);
                    }
                    else if (tx.type === 'bridge') {
                        result = await (0, bridgeToken_1.executeBridge)(tx.chainName, tx.details);
                    }
                    else if (tx.type === 'mint') {
                        result = await (0, mintNft_1.executeMintNft)(tx.chainName, tx.details);
                    }
                    else if (tx.type === 'custom') {
                        result = await (0, customTx_1.executeCustomTx)(tx.chainName, tx.details);
                    }
                    transactionManager_1.txManager.updateStatus(txId, 'executed', result);
                    const prettyMsg = (0, formatter_1.formatTransactionSuccess)(tx, result);
                    bot.sendMessage(chatId, `✅ Transaction processed:\n\n${prettyMsg}`);
                    // Sync with dashboard
                    reasoning_1.logger.addEntry({ role: 'assistant', content: `✅ Transaction processed:\n\n${prettyMsg}` });
                    reasoning_1.logger.addEntry({ role: 'tool', name: tx.type === 'swap' ? 'swap_token' : 'transfer_native', content: result });
                    // Background update to LLM
                    (0, reasoning_1.processUserInput)(`Transaction ${txId} was APPROVED via Telegram. Result: ${result}`, 'system').catch(() => { });
                }
                catch (err) {
                    transactionManager_1.txManager.updateStatus(txId, 'failed', err.message);
                    const prettyError = (0, formatter_1.formatTransactionError)(tx, err.message);
                    bot.sendMessage(chatId, prettyError);
                    // Background update to LLM
                    (0, reasoning_1.processUserInput)(`Transaction ${txId} FAILED via Telegram. Error: ${err.message}`, 'system').catch(() => { });
                }
            }
            else if (action === 'reject') {
                transactionManager_1.txManager.updateStatus(txId, 'rejected');
                (0, reasoning_1.processUserInput)(`Transaction ${txId} was REJECTED via Telegram. Acknowledge this briefly.`, 'system').catch(() => { });
                bot.answerCallbackQuery(query.id, { text: 'Transaction cancelled.' });
                bot.sendMessage(chatId, `❌ Transaction cancelled.`);
            }
            // Remove inline keyboard
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message?.message_id });
        });
        bot.on('polling_error', (error) => {
            console.error('[Telegram] Polling error:', error);
        });
        console.log('🤖 Telegram Bot is running and listening for messages...');
    }
    catch (error) {
        console.error('[Telegram] Failed to initialize bot:', error);
    }
}
