import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { LLMProvider, OpenAIAdapter, AnthropicAdapter, GeminiAdapter } from './llmProvider';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';
import { createSmartStreamWrapper } from '../utils/streamSimulator';
import { needsCompression, compressHistory } from '../utils/contextSummarizer';

import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();



import { getOpenAI, executeWithRetry } from '../utils/llmUtils';
import { txManager } from './transactionManager';
import { promptBuilder } from './promptBuilder';

async function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'general', userInput: string = ''): Promise<string> {
    const config = loadConfig();
    const provider = (config?.llm?.provider || '').toLowerCase();
    let modelFamily: 'openai' | 'google' | 'anthropic' | 'grok' | 'unknown' = 'unknown';
    if (provider.includes('openai')) modelFamily = 'openai';
    else if (provider.includes('gemini') || provider.includes('google')) modelFamily = 'google';
    else if (provider.includes('anthropic') || provider.includes('claude')) modelFamily = 'anthropic';
    else if (provider.includes('grok') || provider.includes('xai')) modelFamily = 'grok';

    return await promptBuilder.buildSystemPrompt({
        agentType: context,
        userInput,
        config,
        modelFamily
    });
}

// ──────────────────────────────────────────────────────────────────
// Module-level routing keyword constants
// Defined here once and shared by both processUserInput() and processUserInputStream()
// to ensure consistent routing across sync and streaming paths.
//
// NOTE: Arrays are intentionally multilingual. Nyxora targets a global user base.
// Indonesian terms are included as the primary non-English locale.
// To add another language, extend these arrays — no other changes required.
// ──────────────────────────────────────────────────────────────────
const OS_KEYWORDS: string[] = [
  // Files, Documents & Notes
  'excel', 'xlsx', 'spreadsheet', 'generate excel',
  'file', 'folder', 'directory', 'read file', 'write file', 'pdf', 'word', 'docx', 'document',
  'note', 'catat', 'catatan', 'keep', 'download', 'unduh', 'link',
  // Terminal & Git
  'terminal', 'command', 'shell', 'bash', 'script', 'run command',
  'git', 'commit', 'push', 'pull', 'clone', 'branch', 'merge',
  // Web & Search
  'search web', 'google', 'browse', 'scrape', 'weather', 'news', 'search', 'find', 'look up',
  // Email & Workspace
  'email', 'gmail', 'google docs', 'google sheets', 'notion', 'calendar',
  // Social & Media
  'twitter', 'tweet', 'x post', 'transcribe', 'audio',
  // Messaging & File Upload
  'telegram', 'discord', 'kirim file', 'send file', 'upload file', 'upload', 'attach', 'share file', 'share link',
  // AI Settings
  'rename agent', 'change persona', 'update profile', 'update identity', 'setting',
  // Summarization
  'summarize', 'summary', 'ringkas',
  // Search & Info queries (Global + ID)
  'cariin', 'cari', 'lihat', 'jadwal', 'info', 'berita', 'schedule',
  'cek email', 'cek kalender', 'cek file', 'cek folder', 'check email', 'check calendar', 'check file',
];

const WEB3_KEYWORDS: string[] = [
  // Transactions
  'swap', 'bridge', 'transfer',
  // Safe Send Actions (Explicit)
  'send token', 'send eth', 'send bnb', 'send usdt', 'send usdc', 'send sol',
  'send btc', 'send crypto', 'send coin', 'send nft', 'send funds',
  'buy', 'sell', 'purchase', 'trade',
  'mint', 'stake', 'unstake', 'claim', 'deposit', 'withdraw', 'approve',
  // Assets & Wallets
  'token', 'crypto', 'coin', 'nft', 'wallet', 'address', 'contract',
  // Major Chains & L2s
  'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'mainnet', 'testnet',
  'on-chain', 'blockchain', 'solana', 'avalanche', 'base',
  // Top 50+ Global Assets / Tickers
  'eth', 'bnb', 'usdt', 'usdc', 'sol', 'matic', 'arb', 'op', 'btc', 'bitcoin',
  'xrp', 'doge', 'dogecoin', 'avax', 'ada', 'cardano', 'pepe', 'shib', 'shiba',
  'link', 'chainlink', 'dot', 'polkadot', 'trx', 'tron', 'ton', 'wbtc', 'dai',
  // DeFi & Market
  'defi', 'dex', 'liquidity', 'pool', 'aave', 'uniswap', 'apy', 'apr', 'yield',
  'price', 'chart', 'market', 'portfolio', 'balance', 'mc', 'marketcap',
  'gas', 'fee', 'slippage', 'transaction', 'tx', 'gwei',
  // Fiat & Currency
  'usd', 'eur', 'gbp', 'jpy', 'aud', 'idr', 'fiat', 'currency', 'convert', 'exchange', 'rate', 'value',
];




// ── P2: Multi-Intent Decomposer ─────────────────────────────────────────────
/**
 * Detects if the user message contains BOTH web3 AND os intents.
 * Returns 'compound' when both are present so we can route to both agents.
 * 
 * IMPORTANT: This check runs BEFORE the LLM router to save tokens.
 * Keyword matching must be precise to avoid false 'compound' classifications
 * that would cause two agents to run in parallel unnecessarily.
 */
function detectCompoundIntent(
  lowerInput: string,
  osKeywords: string[],
  web3Keywords: string[]
): { hasOs: boolean; hasWeb3: boolean } {
  // FIX: Use score-based detection instead of naive boolean OR.
  // A single keyword match is often a false positive (e.g. 'cek' in a web3 query,
  // or 'balance' in a file management query). Only trigger compound if BOTH sides
  // have meaningful signal (score >= 2), OR if the dominant side has score >= 2 
  // while the other has >= 1 but is not clearly overshadowed (score ratio < 3:1).
  const osScore = osKeywords.filter(kw => lowerInput.includes(kw)).length;
  const web3Score = web3Keywords.filter(kw => lowerInput.includes(kw)).length;

  // If either side has no hits, it's clearly single-intent
  if (osScore === 0 || web3Score === 0) {
    return { hasOs: osScore > 0, hasWeb3: web3Score > 0 };
  }

  // If one side dominates by 3:1 or more, treat as single-intent
  if (web3Score >= osScore * 3) return { hasOs: false, hasWeb3: true };
  if (osScore >= web3Score * 3) return { hasOs: true, hasWeb3: false };

  // Both sides have meaningful signal — genuine compound
  return { hasOs: true, hasWeb3: true };
}


// ── P7: Task Planner ─────────────────────────────────────────────────────────
// Trigger keywords for complex requests that benefit from a planning step first.
// Intentionally multilingual: includes common terms from Indonesian (id), English (en),
// and universal finance/trading vocabulary to support Nyxora's global user base.
const PLAN_TRIGGER_KEYWORDS = [
  // Indonesian
  'buatkan', 'buat rencana', 'rencanakan', 'strategi', 'gimana cara', 'bagaimana cara',
  'langkah', 'optimasi', 'apa yang harus',
  // English
  'strategy', 'plan', 'planning', 'step by step', 'breakdown', 'optimize',
  'rebalance', 'what should i do', 'help me decide', 'how do i',
  // Universal finance terms
  'roadmap', 'approach', 'framework',
];

function shouldPlan(input: string): boolean {
  const lower = input.toLowerCase();
  return PLAN_TRIGGER_KEYWORDS.some(kw => lower.includes(kw));
}

async function runTaskPlanner(input: string, context: string): Promise<string> {
  const config = loadConfig();
  try {
    const planRes = await executeWithRetry(async (client) =>
      client.chat({
        model: config.llm.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are a concise task planning assistant.
The user has a complex multi-step request. Output a brief, ordered execution plan with 3-5 bullet points (max 120 words total).
Each bullet = one concrete action or tool call.
Be extremely concise. No intros, no explanations.
Context domain: ${context}`
          },
          { role: 'user', content: `Plan execution for: ${input}` }
        ]
      })
    );
    const plan = planRes.message?.content?.trim() || '';
    if (!plan) return '';
    // Enforce max length — truncate to ~120 words to prevent context bloat
    const words = plan.split(/\s+/);
    const trimmedPlan = words.length > 120 ? words.slice(0, 120).join(' ') + '...' : plan;
    console.log(pc.blue('[TaskPlanner] Plan generated, injecting into agent context.'));
    return `--- 📋 EXECUTION PLAN ---\n${trimmedPlan}\n--- END PLAN ---`;
  } catch {
    return ''; // planning is best-effort, never block the agent
  }
}

import { processWeb3Intent } from './web3Agent';
import { processOsIntent } from './osAgent';
import { processWeb3IntentStream } from './web3Agent';
import { processOsIntentStream } from './osAgent';

export async function processUserInput(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const lowerInput = input.toLowerCase();
  
  const config = loadConfig();
  const history = logger.getHistory(sessionId);
  
  // Filter history to text-only for Router & General agent to prevent Gemini 400 Invalid Argument
  const textOnlyHistory = history
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content || "" }));
  
  // Uses module-level OS_KEYWORDS and WEB3_KEYWORDS constants defined above.
  // Routing logic: deterministic keyword check first (no LLM call needed),
  // with LLM router as fallback for ambiguous inputs.


  let context: 'web3' | 'os' | 'general' = 'general';
  let preCheckMatched = false;

  const compound = detectCompoundIntent(lowerInput, OS_KEYWORDS, WEB3_KEYWORDS);

  // P2: Handle compound web3+os intent — run both agents and merge results
  // FIX: Do NOT addEntry here — each sub-agent (processWeb3Intent / processOsIntent)
  // calls logger.addEntry({ role, content: input }) internally. Adding here would
  // result in the user message being stored 3x in history.
  if (compound.hasWeb3 && compound.hasOs) {
    console.log(pc.cyan('[Orchestrator] Compound intent detected (web3 + os). Running both agents sequentially.'));
    const [web3Result, osResult] = await Promise.allSettled([
      processWeb3Intent(input, role, onProgress, sessionId),
      processOsIntent(input, role, onProgress, sessionId),
    ]);
    // FIX: Filter out fallback/empty responses. If an agent couldn't handle the request,
    // don't include its "No response generated." in the merged output.
    const FALLBACK_STRINGS = ['No response generated.', 'no response generated', '\u26a0️'];
    const parts: string[] = [];
    if (web3Result.status === 'fulfilled' && web3Result.value &&
        !FALLBACK_STRINGS.some(f => web3Result.value.trim().startsWith(f))) {
      parts.push(web3Result.value);
    }
    if (osResult.status === 'fulfilled' && osResult.value &&
        !FALLBACK_STRINGS.some(f => osResult.value.trim().startsWith(f))) {
      parts.push(osResult.value);
    }
    if (parts.length === 0) return '⚠️ Both agents returned empty responses.';
    return parts.length === 1 ? parts[0] : parts.join('\n\n---\n\n');
  }

  // Single-intent routing
  if (compound.hasOs) {
    context = 'os';
    preCheckMatched = true;
  } else if (compound.hasWeb3) {
    context = 'web3';
    preCheckMatched = true;
  }

  if (preCheckMatched) {
    console.log(pc.cyan(`[Orchestrator] Intent pre-classified (keyword match) as: ${context.toUpperCase()}`));
  } else {
    // ── Fallback: LLM Router (untuk intent ambigu / percakapan umum) ─────────
    const routerPrompt = `You are Nyxora's Semantic Intent Router. Your job is to classify the user's FINAL message into one of four categories: 'web3', 'os', 'compound', or 'general'.
Rules:
1. FOCUS ONLY ON THE FINAL MESSAGE. History is only for context.
2. The user may speak in ANY language, including casual slang, idioms, or abbreviations.
3. If the core intent involves BOTH blockchain/finance AND system automation/files/emails, reply 'compound'.
4. If the core intent involves ONLY blockchain, crypto, bridging, swapping, trading, sending/receiving, tokens, wallets, transactions, OR asking for the price/conversion of ANY asset to fiat, reply 'web3'.
5. If the core intent involves ONLY OS automation, weather, emails, files, terminal, changing AI settings, OR asking ANY question that requires a web search or real-world factual lookup (e.g., 'who won the game', 'what is the registration date', 'cek info', 'cari tahu'), reply 'os'.
6. If it is purely casual conversation, chit-chat, or greetings, reply 'general'.
Reply with EXACTLY ONE WORD: compound, web3, os, or general.`;

    const routerMessages = [
        { role: 'system', content: routerPrompt },
        ...textOnlyHistory.slice(-10),
        { role: 'user', content: input }
    ];

    try {
        const routerResponse = await executeWithRetry(async (client) => {
            return await client.chat({
                model: config.llm.model,
                messages: routerMessages as any,
                temperature: 0.1,
                max_tokens: 1000
            });
        }, 3); // 3 retries for transient 503/429 errors
        
        let contextResponse = (routerResponse.message.content || 'general').toLowerCase().trim();
        
        if (contextResponse.includes('compound')) {
           console.log(pc.cyan('[Orchestrator] Compound intent detected via LLM Router. Running both agents sequentially.'));
           // FIX: Do NOT addEntry here — sub-agents handle their own memory writes.
           const [web3Result, osResult] = await Promise.allSettled([
             processWeb3Intent(input, role, onProgress, sessionId),
             processOsIntent(input, role, onProgress, sessionId),
           ]);
           // FIX: Filter fallback responses
           const FALLBACK_STRINGS = ['No response generated.', 'no response generated', '⚠️'];
           const parts: string[] = [];
           if (web3Result.status === 'fulfilled' && web3Result.value &&
               !FALLBACK_STRINGS.some(f => web3Result.value.trim().startsWith(f))) {
             parts.push(web3Result.value);
           }
           if (osResult.status === 'fulfilled' && osResult.value &&
               !FALLBACK_STRINGS.some(f => osResult.value.trim().startsWith(f))) {
             parts.push(osResult.value);
           }
           if (parts.length === 0) return '⚠️ Both agents returned empty responses.';
           return parts.length === 1 ? parts[0] : parts.join('\n\n---\n\n');
        }
        else if (contextResponse.includes('web3')) context = 'web3';
        else if (contextResponse.includes('os')) context = 'os';
        else context = 'general';
    } catch (e) {
        console.warn(`[Orchestrator] Router LLM failed, falling back to general. Error:`, e);
        context = 'general';
    }

    console.log(pc.magenta(`[Orchestrator] Intent classified as: ${context.toUpperCase()}`));
  }
  
  if (context === 'web3') {
      // P7: Inject task plan as a system note (NOT prepended to user input to avoid context bloat)
      if (shouldPlan(input)) {
        const planInjection = await runTaskPlanner(input, 'web3');
        if (planInjection) {
          // Inject plan as system message — visible to LLM but doesn't pollute user message size
          logger.addEntry({ role: 'system' as any, content: planInjection }, sessionId);
        }
      }
      return await processWeb3Intent(input, role, onProgress, sessionId);
  } else if (context === 'os') {
      if (shouldPlan(input)) {
        const planInjection = await runTaskPlanner(input, 'os');
        if (planInjection) {
          logger.addEntry({ role: 'system' as any, content: planInjection }, sessionId);
        }
      }
      return await processOsIntent(input, role, onProgress, sessionId);
  } else {
      // General Agent: Use osAgent logic but without execution tools to save tokens.
      // Wait, osAgent has activeTools. We can just route to osAgent for now, but general agent shouldn't have tools.
      // Let's create a dummy general intent processing directly here.
      logger.addEntry({ role, content: input }, sessionId);
      
      const messages = [
        { role: 'system', content: await getSystemPrompt('general', input) },
        ...textOnlyHistory,
        { role: 'user', content: input }
      ];
      
      try {
          const response = await executeWithRetry(async (client) => {
              return await client.chat({
                  model: config.llm.model,
                  messages: messages as any
              });
          });
          
          let finalContent = response.message?.content || "";
          finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>\n?/gi, '');
          finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>\n?/gi, '');
          finalContent = finalContent.trim();
          
          if (!finalContent) {
             finalContent = "⚠️ The LLM returned an empty or truncated response. This usually happens due to API connection fluctuations or temporary rate limits. Please try again.";
          }
          
          logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
          return finalContent;
      } catch (error: any) {
          console.error("General LLM Error:", error);
          const status = error?.status || error?.response?.status;
          let errorMsg = '⚠️ The system is experiencing LLM API rate limits. Please wait a few seconds and try again.';
          
          if (status === 400 || (error.message && error.message.toLowerCase().includes('invalid'))) {
              errorMsg = '⚠️ An error occurred. The LLM failed to format the tool or message correctly.';
          }
          
          logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
          return errorMsg;
      }
  }
}

/**
 * Streaming variant of processUserInput().
 * Calls onChunk() for each LLM token as it arrives.
 * Falls back to onChunk() with full response if streaming is not supported.
 */
export async function processUserInputStream(
  input: string,
  originalOnChunk: (text: string) => void,
  onProgress?: (msg: string) => void,
  sessionId?: string
): Promise<string> {
  const smartStream = createSmartStreamWrapper(originalOnChunk);
  const onChunk = smartStream.onChunk;

  try {
    const lowerInput = input.toLowerCase();
    const config = loadConfig();
    const history = logger.getHistory(sessionId);

    const textOnlyHistory = history
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content || '' }));

    // Use module-level keyword constants for consistent routing across sync and stream paths.
    // detectCompoundIntent and shouldPlan are also shared from the module scope.

    let context: 'web3' | 'os' | 'general' = 'general';
    let preCheckMatched = false;

    // P2: Compound intent detection (stream path)
    const streamCompound = detectCompoundIntent(lowerInput, OS_KEYWORDS, WEB3_KEYWORDS);

    const pendingTxs = txManager.getPending();
    if (pendingTxs.length > 0) {
      context = 'web3';
      preCheckMatched = true;
    } else if (streamCompound.hasWeb3 && streamCompound.hasOs) {
      // Compound: stream both agents and concatenate
      // FIX: Do NOT addEntry here — processWeb3IntentStream / processOsIntentStream do it internally.
      console.log(pc.cyan('[Stream Orchestrator] Compound intent detected (web3 + os).'));
      const [web3R, osR] = await Promise.allSettled([
        processWeb3IntentStream(input, onChunk, onProgress, sessionId),
        processOsIntentStream(input, onChunk, onProgress, sessionId),
      ]);
      // FIX: Filter fallback responses from compound merge
      const FALLBACK_STRINGS_S = ['No response generated.', 'no response generated', '⚠️'];
      const parts: string[] = [];
      if (web3R.status === 'fulfilled' && web3R.value &&
          !FALLBACK_STRINGS_S.some(f => web3R.value.trim().startsWith(f))) {
        parts.push(web3R.value);
      }
      if (osR.status === 'fulfilled' && osR.value &&
          !FALLBACK_STRINGS_S.some(f => osR.value.trim().startsWith(f))) {
        parts.push(osR.value);
      }
      if (parts.length === 0) return '⚠️ Both agents returned empty responses.';
      return parts.length === 1 ? parts[0] : parts.join('\n\n---\n\n');
    } else if (streamCompound.hasOs) {
      context = 'os';
      preCheckMatched = true;
    } else if (streamCompound.hasWeb3) {
      context = 'web3';
      preCheckMatched = true;
    }

    if (!preCheckMatched) {
      const routerPrompt = `You are Nyxora's Semantic Intent Router. Your job is to classify the user's FINAL message into one of four categories: 'web3', 'os', 'compound', or 'general'.
Rules:
1. FOCUS ONLY ON THE FINAL MESSAGE. History is only for context.
2. The user may speak in ANY language, including casual slang, idioms, or abbreviations.
3. If the core intent involves BOTH blockchain/finance AND system automation/files/emails, reply 'compound'.
4. If the core intent involves ONLY blockchain, crypto, bridging, swapping, trading, sending/receiving, tokens, wallets, transactions, OR asking for the price/conversion of ANY asset to fiat, reply 'web3'.
5. If the core intent involves ONLY OS automation, weather, emails, files, terminal, changing AI settings, OR asking ANY question that requires a web search or real-world factual lookup (e.g., 'who won the game', 'what is the registration date', 'cek info', 'cari tahu'), reply 'os'.
6. If it is purely casual conversation, chit-chat, or greetings, reply 'general'.
Reply with EXACTLY ONE WORD: compound, web3, os, or general.`;
      const routerMessages = [
        { role: 'system', content: routerPrompt },
        ...textOnlyHistory.slice(-10),
        { role: 'user', content: input }
      ];
      try {
        const routerResponse = await executeWithRetry(async (client) =>
          client.chat({ model: config.llm.model, messages: routerMessages as any, temperature: 0.1, max_tokens: 1000 })
        , 3);
        const cr = (routerResponse.message.content || 'general').toLowerCase().trim();
        if (cr.includes('compound')) {
          console.log(pc.cyan('[Stream Orchestrator] Compound intent detected via LLM Router.'));
          // FIX: Do NOT addEntry here — sub-agents handle their own memory writes.
          const [web3R, osR] = await Promise.allSettled([
            processWeb3IntentStream(input, onChunk, onProgress, sessionId),
            processOsIntentStream(input, onChunk, onProgress, sessionId),
          ]);
          // FIX: Filter fallback responses
          const FALLBACK_STRINGS_SR = ['No response generated.', 'no response generated', '⚠️'];
          const parts: string[] = [];
          if (web3R.status === 'fulfilled' && web3R.value &&
              !FALLBACK_STRINGS_SR.some(f => web3R.value.trim().startsWith(f))) {
            parts.push(web3R.value);
          }
          if (osR.status === 'fulfilled' && osR.value &&
              !FALLBACK_STRINGS_SR.some(f => osR.value.trim().startsWith(f))) {
            parts.push(osR.value);
          }
          if (parts.length === 0) return '⚠️ Both agents returned empty responses.';
          return parts.length === 1 ? parts[0] : parts.join('\n\n---\n\n');
        }
        else if (cr.includes('web3')) context = 'web3';
        else if (cr.includes('os')) context = 'os';
        else context = 'general';
      } catch {
        context = 'general';
      }
    }

    console.log(pc.cyan(`[Stream Orchestrator] Intent classified as: ${context.toUpperCase()}`));

    let finalResult = '';
    if (context === 'web3') {
      // P7: Inject task plan as a system note (NOT prepended to user input to avoid context bloat)
      if (shouldPlan(input)) {
        const planInjection = await runTaskPlanner(input, 'web3');
        if (planInjection) {
          logger.addEntry({ role: 'system' as any, content: planInjection }, sessionId);
        }
      }
      finalResult = await processWeb3IntentStream(input, onChunk, onProgress, sessionId);
    } else if (context === 'os') {
      if (shouldPlan(input)) {
        const planInjection = await runTaskPlanner(input, 'os');
        if (planInjection) {
          logger.addEntry({ role: 'system' as any, content: planInjection }, sessionId);
        }
      }
      finalResult = await processOsIntentStream(input, onChunk, onProgress, sessionId);
    } else {
      logger.addEntry({ role: 'user', content: input }, sessionId);
      const messages = [
        { role: 'system', content: await getSystemPrompt('general', input) },
        ...textOnlyHistory,
        { role: 'user', content: input }
      ];
      try {
        let streamedContent = '';
        const response = await executeWithRetry(async (client) => {
          streamedContent = '';
          onChunk('[CLEAR_STREAM]');
          return client.stream(
            { model: config.llm.model, messages: messages as any },
            (chunk: string) => { streamedContent += chunk; onChunk(chunk); }
          );
        });
        let finalContent = response.message?.content || streamedContent || '';
        finalContent = finalContent
          .replace(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>[\s\S]*?<\/\1>\n?/gi, '')
          .trim();
        if (!finalContent) finalContent = '⚠️ The LLM returned an empty response. Please try again.';
        logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
        finalResult = finalContent;
      } catch (error: any) {
        const errorMsg = '⚠️ The system is experiencing LLM API rate limits. Please try again.';
        logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
        finalResult = errorMsg;
      }
    }
    
    return finalResult;
  } finally {
    await smartStream.wait();
  }
}
