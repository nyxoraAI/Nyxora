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

      let buffer = '';
      let progressMsgId: number | null = null;
      let pendingEdit: NodeJS.Timeout | null = null;
      let isFinalized = false;
      // FIX: Track whether the last chunk was the final content (fast-return path).
      // If true, the buffer already contains the final response — no need to re-send.
      let finalContentAlreadyStreamed = false;
      
      const flushEdit = async () => {
        if (isFinalized) return;
        const displayHtml = formatToTelegramHTML(buffer);
        try {
          if (!progressMsgId) {
            const sent = await ctx.reply(displayHtml, { parse_mode: 'HTML', reply_parameters: { message_id: ctx.message.message_id } as any });
            progressMsgId = sent.message_id;
          } else {
            // RC#4 FIX: Use Grammy's API instead of raw fetch()
            // Raw fetch() had no response.ok check — 429 errors were silently swallowed.
            // Grammy's editMessageText throws on API errors, allowing proper handling.
            await ctx.api.editMessageText(ctx.chat.id, progressMsgId, displayHtml, { parse_mode: 'HTML' });
          }
        } catch (e: any) {
          // During live streaming, 429 (rate limit) is expected and acceptable.
          // The final edit will correct any missed intermediate updates.
          const is429 = e?.error_code === 429 || e?.description?.includes('Too Many Requests');
          const isUnchanged = e?.description?.includes('message is not modified');
          if (!is429 && !isUnchanged) {
            console.warn('[Telegram] Live edit failed:', e?.description || e?.message);
          }
        }
      };

      const scheduleEdit = () => {
        if (pendingEdit || isFinalized) return;
        pendingEdit = setTimeout(async () => {
          pendingEdit = null;
          await flushEdit();
        }, 1100); // 1.1s safe limit to avoid 429 without hitting queue
      };

      // Keep sending 'typing' action every 5 seconds while processing
      const typingInterval = setInterval(() => {
        ctx.replyWithChatAction('typing').catch(() => {});
      }, 5000);

      const onChunk = async (chunk: string) => {
        if (chunk === '[CLEAR_STREAM]') {
          // Turn 1 starting — reset to clean state
          buffer = '⏳ Processing...';
          finalContentAlreadyStreamed = false;
        } else if (chunk === '[TOOL_CALL_DETECTED]') {
          // BUG#1 FIX: LLM made a tool call — wipe turn-1 planning/thinking text from buffer.
          // The LLM often generates "chain-of-thought" text before calling a tool (e.g. "Let me
          // check the data first..."). This should NOT be shown to users. We reset the buffer to
          // a clean progress indicator, preserving progressMsgId so the same message gets reused.
          buffer = '⏳ Processing...';
          finalContentAlreadyStreamed = false;
          scheduleEdit(); // Update Telegram immediately to show clean state
        } else {
          buffer += chunk;
        }
        scheduleEdit();
      };

      const onProgress = async (msg: string) => {
        buffer += `\n${msg}\n`;
        scheduleEdit();
      };

      try {
        const response = await processUserInputStream(
          text, onChunk, onProgress, `telegram_${ctx.chat?.id}`
        );
        isFinalized = true;
        if (pendingEdit) {
            clearTimeout(pendingEdit);
            pendingEdit = null;
        }
        clearInterval(typingInterval);

        // ── Message Splitting Helper ─────────────────────────────────────────
        // BUG#2 FIX: Telegram hard-limits all text to 4096 chars.
        // Long responses (comprehensive analysis, detailed reports) frequently exceed this.
        // Split at natural boundaries: paragraphs → newlines → words. Never split inside HTML tags.
        const TELEGRAM_MAX = 4000; // 96-char buffer below 4096 hard limit

        const splitHtmlMessage = (html: string): string[] => {
          if (html.length <= TELEGRAM_MAX) return [html];
          const chunks: string[] = [];
          let remaining = html;

          while (remaining.length > TELEGRAM_MAX) {
            let splitAt = TELEGRAM_MAX;

            // Prefer paragraph break (\n\n)
            const lastPara = remaining.lastIndexOf('\n\n', TELEGRAM_MAX);
            if (lastPara > TELEGRAM_MAX / 2) {
              splitAt = lastPara + 2;
            } else {
              // Fall back to newline
              const lastNewline = remaining.lastIndexOf('\n', TELEGRAM_MAX);
              if (lastNewline > TELEGRAM_MAX / 2) {
                splitAt = lastNewline + 1;
              } else {
                // Fall back to word boundary
                const lastSpace = remaining.lastIndexOf(' ', TELEGRAM_MAX);
                if (lastSpace > TELEGRAM_MAX / 2) splitAt = lastSpace + 1;
                // Hard cut as last resort
              }
            }

            chunks.push(remaining.substring(0, splitAt).trim());
            remaining = remaining.substring(splitAt).trim();
          }

          if (remaining.length > 0) chunks.push(remaining);
          return chunks;
        };

        // ── Reliable Final Send ──────────────────────────────────────────────
        // RC#3 FIX: Retry on 429 with exponential backoff.
        // BUG#2 FIX: Detect MESSAGE_TOO_LONG and split into multiple messages.
        const editFinal = async (html: string, markup?: any): Promise<void> => {
          const htmlChunks = splitHtmlMessage(html);
          const MAX_ATTEMPTS = 3;

          for (let ci = 0; ci < htmlChunks.length; ci++) {
            const chunk = htmlChunks[ci];
            const isLast = ci === htmlChunks.length - 1;
            const chunkMarkup = isLast ? markup : undefined;

            let sent = false;
            for (let attempt = 0; attempt < MAX_ATTEMPTS && !sent; attempt++) {
              try {
                if (ci === 0 && progressMsgId) {
                  // Edit the existing in-progress message with first chunk
                  await ctx.api.editMessageText(ctx.chat.id, progressMsgId, chunk, { parse_mode: 'HTML', reply_markup: chunkMarkup });
                } else {
                  // Send additional chunks as new messages
                  await ctx.reply(chunk, { parse_mode: 'HTML', reply_markup: chunkMarkup, reply_parameters: { message_id: ctx.message.message_id } as any });
                }
                sent = true;
              } catch (e: any) {
                const is429 = e?.error_code === 429 || e?.description?.includes('Too Many Requests');
                const isUnchanged = e?.description?.includes('message is not modified');
                const isTooLong = e?.description?.includes('MESSAGE_TOO_LONG');

                if (isUnchanged) { sent = true; break; }

                if (is429 && attempt < MAX_ATTEMPTS - 1) {
                  const waitMs = (attempt + 1) * 2000;
                  console.warn(`[Telegram] Final edit 429. Retry in ${waitMs}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
                  await new Promise(r => setTimeout(r, waitMs));
                  continue;
                }

                if (isTooLong) {
                  // This should not happen after splitting, but handle defensively
                  console.error('[Telegram] Chunk still too long after split — hard-truncating.');
                  const truncated = chunk.substring(0, TELEGRAM_MAX - 100) + '...\n\n_(Response truncated — ask again for details)_';
                  await ctx.reply(truncated, { parse_mode: 'HTML', reply_parameters: { message_id: ctx.message.message_id } as any }).catch(() => {});
                  sent = true;
                  break;
                }

                console.error(`[Telegram] editFinal attempt ${attempt + 1} failed: ${e?.description || e?.message}`);

                if (attempt === MAX_ATTEMPTS - 1) {
                  // All retries exhausted — last resort: send as new message
                  console.warn('[Telegram] All retries exhausted. Sending as new message.');
                  await ctx.reply(chunk, { parse_mode: 'HTML', reply_markup: chunkMarkup, reply_parameters: { message_id: ctx.message.message_id } as any }).catch(fe => {
                    console.error('[Telegram] CRITICAL: Fallback reply also failed:', fe.message);
                  });
                  sent = true;
                }
              }
            }
          }
        };

        const finalHtml = formatToTelegramHTML(response);

        const cleanBuffer = buffer.replace(/\n⏳ Processing\.\.\.\n?/g, '').replace(/\n_⚡[^\n]*_\n?/g, '').trim();
        const cleanResponse = response.trim();
        finalContentAlreadyStreamed = cleanBuffer === cleanResponse || buffer.includes(cleanResponse);

        let replyMarkup: any = undefined;
        if (/Reply \*\*Yes\*\*/i.test(response) && /\*\*No\*\* to cancel/i.test(response)) {
          replyMarkup = new InlineKeyboard()
            .text('✅ Approve', 'tx_approve')
            .text('❌ Reject', 'tx_reject');
        }

        await editFinal(finalHtml, replyMarkup);
      } catch (error: any) {
        clearInterval(typingInterval);
        console.error('[Telegram] Error processing message:', error);
        await ctx.reply(
          '❌ Sorry, I encountered an error while processing your message.',
          { reply_parameters: { message_id: ctx.message.message_id } as any }
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
        
        const typingInterval = setInterval(() => {
          ctx.replyWithChatAction('typing').catch(() => {});
        }, 5000);
        
        let buffer = '';
        let progressMsgId: number | null = null;
        let pendingEdit: NodeJS.Timeout | null = null;
        let isFinalized = false;
        
        const flushEdit = async () => {
          if (isFinalized) return;
          const displayHtml = formatToTelegramHTML(buffer);
          try {
            if (!progressMsgId) {
              const sent = await ctx.reply(displayHtml, { parse_mode: 'HTML' });
              progressMsgId = sent.message_id;
            } else {
              // RC#4 FIX: Use Grammy API instead of raw fetch()
              await ctx.api.editMessageText(ctx.chat.id, progressMsgId, displayHtml, { parse_mode: 'HTML' });
            }
          } catch (e: any) {
            const is429 = e?.error_code === 429 || e?.description?.includes('Too Many Requests');
            const isUnchanged = e?.description?.includes('message is not modified');
            if (!is429 && !isUnchanged) {
              console.warn('[Telegram] Callback live edit failed:', e?.description || e?.message);
            }
          }
        };

        const scheduleEdit = () => {
          if (pendingEdit || isFinalized) return;
          pendingEdit = setTimeout(async () => {
            pendingEdit = null;
            await flushEdit();
          }, 1100);
        };
        
        const onChunk = async (chunk: string) => {
          if (chunk === '[CLEAR_STREAM]') {
            buffer = '⏳ Processing...';
          } else {
            buffer += chunk;
          }
          scheduleEdit();
        };

        const onProgress = async (msg: string) => {
          buffer += `\n${msg}\n`;
          scheduleEdit();
        };

        try {
          const response = await processUserInputStream(simulatedText, onChunk, onProgress, `telegram_${ctx.chat.id}`);
          isFinalized = true;
          if (pendingEdit) {
            clearTimeout(pendingEdit);
            pendingEdit = null;
          }
          clearInterval(typingInterval);

          let replyMarkup: any = undefined;
          if (/Reply \*\*Yes\*\*/i.test(response) && /\*\*No\*\* to cancel/i.test(response)) {
            replyMarkup = new InlineKeyboard().text('✅ Approve', 'tx_approve').text('❌ Reject', 'tx_reject');
          }
          const finalHtml = formatToTelegramHTML(response);

          // RC#3 FIX: Same retry + fallback logic as the text message handler
          const editFinalCb = async (html: string, markup?: any): Promise<void> => {
            const MAX_ATTEMPTS = 3;
            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
              try {
                if (progressMsgId) {
                  await ctx.api.editMessageText(ctx.chat.id, progressMsgId, html, { parse_mode: 'HTML', reply_markup: markup });
                } else {
                  await ctx.reply(html, { parse_mode: 'HTML', reply_markup: markup });
                }
                return;
              } catch (e: any) {
                const is429 = e?.error_code === 429 || e?.description?.includes('Too Many Requests');
                const isUnchanged = e?.description?.includes('message is not modified');
                if (isUnchanged) return;
                if (is429 && attempt < MAX_ATTEMPTS - 1) {
                  await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
                  continue;
                }
                if (attempt === MAX_ATTEMPTS - 1) {
                  await ctx.reply(html, { parse_mode: 'HTML', reply_markup: markup }).catch(fe => {
                    console.error('[Telegram] CRITICAL: Callback fallback reply failed:', fe.message);
                  });
                }
                return;
              }
            }
          };
          await editFinalCb(finalHtml, replyMarkup);

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
