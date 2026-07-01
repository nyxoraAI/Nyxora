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

import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();



import { getOpenAI, executeWithRetry } from '../utils/llmUtils';
import { txManager } from './transactionManager';
function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'general'): string {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('en-US');
    let basePrompt = "";

    if (context === 'web3') {
      basePrompt = `You are Nyxora's Web3 Agent (DeFi Specialist).
The current real-world date and time is: ${currentDateTime}.
Default Chain: ${config.agent.default_chain}

CRITICAL: You MUST use a Chain of Thought approach for every response. Enclose your reasoning within <think>...</think> tags.
IMPORTANT: The <think> block is strictly for internal monologue. Your final answer must be OUTSIDE and AFTER the </think> tag.

[WEB3 EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt.
CRITICAL RULE 3: DEFAULT CHAIN HANDLING. Default to: ${config.agent.default_chain} unless specified.
CRITICAL RULE 4: CONDITIONAL PARALLEL EXECUTION. Parallel tool execution is ONLY allowed if there are zero data dependencies.
CRITICAL RULE 5: TRANSACTION EXECUTION. For ALL state-changing transactions (swap, bridge, transfer), execute IMMEDIATELY. It will trigger a secure popup.
CRITICAL RULE 6: NETWORK SAFETY VALIDATION. NEVER GUESS chains or tokens. Ask for confirmation if ambiguous.
CRITICAL RULE 7: TOOL CONFIDENCE & HALUCINATION PREVENTION. NEVER fabricate blockchain data.
CRITICAL RULE 8: AMOUNT PRECISION. Use 6 decimal places for precision, or 2 if >$10,000.
CRITICAL RULE 9: MARKET CONFIDENCE SCORE. Declare a 'Confidence Score (0-100%)' inside <think>. Warn if < 40%.`;
    } else if (context === 'os') {
      basePrompt = `You are Nyxora's OS Agent (System & Automation Specialist).
The current real-world date and time is: ${currentDateTime}.

CRITICAL: You MUST use a Chain of Thought approach for every response. Enclose your reasoning within <think>...</think> tags.
IMPORTANT: The <think> block is strictly for internal monologue. Your final answer must be OUTSIDE and AFTER the </think> tag.

[OS EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt.
CRITICAL RULE 3: FILE SYSTEM SAFETY. You are STRICTLY FORBIDDEN from modifying config.yaml, rpc_key.yaml, or policy.yaml using terminal commands like sed or echo.
CRITICAL RULE 4: CRON JOBS VS LIMIT ORDERS. Do NOT use schedule_task for price-based trading triggers. Use schedule_task for time-based recurring tasks.
CRITICAL RULE 5: TOOL CONFIDENCE. NEVER fabricate file contents or command outputs.`;
    } else {
      basePrompt = `You are Nyxora's General Agent.
The current real-world date and time is: ${currentDateTime}.

CRITICAL: You MUST use a Chain of Thought approach for every response. Enclose your reasoning within <think>...</think> tags.
IMPORTANT: The <think> block is strictly for internal monologue. Your final answer must be OUTSIDE and AFTER the </think> tag.

[GENERAL WORKFLOW]
CRITICAL RULE 1: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt.
CRITICAL RULE 2: BE HELPFUL AND CONCISE. You do not have Web3 or OS tools in this context. If the user asks for Web3 or OS tasks, politely inform them to rephrase using clear keywords like 'transfer', 'harga', 'file', 'email', etc.`;
    }

  const identityMdPath = getPath('IDENTITY.md');
  const userMdPath = getPath('user.md');
  
  let isFirstTime = false;
  try {
    const identityContent = fs.existsSync(identityMdPath) ? fs.readFileSync(identityMdPath, 'utf8').trim() : '';
    const userContent = fs.existsSync(userMdPath) ? fs.readFileSync(userMdPath, 'utf8').trim() : '';
    
    // Check if files are empty or contain the default installation text
    const isIdentityDefault = !identityContent || identityContent.includes('You are a Web3 AI assistant named Nyxora.');
    const isUserDefault = !userContent || userContent.includes('Write custom instructions, special rules, user profiles');
    
    isFirstTime = isIdentityDefault && isUserDefault;
  } catch (e) {
    isFirstTime = true;
  }

  if (isFirstTime) {
    basePrompt += `\n\n[ONBOARDING MODE]
This is your VERY FIRST interaction with the user. You MUST warmly welcome them to Nyxora and ask for 4 things to initialize your setup:
1. Their Name
2. What they want to name YOU (the AI Agent)
3. Their Hobbies or Job (so you can tailor your conversation context)
4. Your Persona/Character (e.g., professional, sarcastic, JARVIS, anime waifu)
Do NOT perform any web3 tasks or generic answers until they provide all 4 details. Once they answer, use 'update_profile' to save their name and hobbies/job to user.md, and use 'update_identity' (making sure to provide the 'agentName' parameter!) to save your new name and persona to IDENTITY.md.`;
  } else {
    // Read IDENTITY.md for core AI persona
    try {
      if (fs.existsSync(identityMdPath)) {
        const identityInstructions = fs.readFileSync(identityMdPath, 'utf8');
        basePrompt += `\n\n--- CORE IDENTITY & PERSONA ---\n${identityInstructions}`;
      }
    } catch (error) {
      console.error('Failed to read IDENTITY.md:', error);
    }

    // Read user.md for custom instructions
    try {
      if (fs.existsSync(userMdPath)) {
        const customInstructions = fs.readFileSync(userMdPath, 'utf8');
        basePrompt += `\n\n--- CUSTOM USER INSTRUCTIONS ---\n${customInstructions}`;
      }
    } catch (error) {
      console.error('Failed to read user.md:', error);
    }
  }

  // Read policy.yaml for NLP security constraints
  try {
    const policyPath = getPath('policy.yaml');
    if (fs.existsSync(policyPath)) {
      const yaml = require('yaml'); // lazily import if not imported
      const file = fs.readFileSync(policyPath, 'utf8');
      const parsed = yaml.parse(file) || {};
      if (parsed.custom_llm_rules && Array.isArray(parsed.custom_llm_rules) && parsed.custom_llm_rules.length > 0) {
        basePrompt += `\n\n--- SECURITY POLICY (MANDATORY RULES) ---\n${parsed.custom_llm_rules.map((r: string) => `* ${r}`).join('\n')}\n\nCRITICAL: If the user asks you to perform an action that violates the Security Policy above, YOU MUST NOT EXECUTE IT DIRECTLY. Instead, ask for their explicit permission first.`;
      }
    }
  } catch (error) {
    console.error('Failed to read policy.yaml:', error);
  }

  // Inject Episodic Memories (Smart Suggestions Context)
  try {
    const recentMemories = episodicDB.getMemories().slice(0, 10);
    if (recentMemories.length > 0) {
      basePrompt += `\n\n--- EPISODIC MEMORIES (SMART SUGGESTIONS) ---\nUse these recent observations to proactively suggest or autocomplete parameters (like networks or tokens) without asking the user if they align with the current request:\n`;
      recentMemories.forEach(mem => {
        basePrompt += `- [${mem.category.toUpperCase()}] ${mem.fact} (Confidence: ${(mem.confidence * 100).toFixed(0)}%)\n`;
      });
    }
  } catch {}

  // V3: Inject Personalized Risk Profile
  try {
    const profile = logger.getUserProfile();
    const personas = episodicDB.getPersonas();
    
    if (profile || personas.length > 0) {
      basePrompt += `\n\n--- [USER_PERSONA] RISK PROFILE & PREFERENCES ---\n`;
      if (profile) {
        basePrompt += `Risk Level: ${profile.risk_level}\n`;
        basePrompt += `Max Slippage Tolerance: ${profile.max_slippage}%\n`;
        basePrompt += `Avoid Memecoins: ${profile.avoid_memecoins ? 'YES' : 'NO'}\n`;
        if (profile.custom_rules) {
          basePrompt += `Custom Rules: ${profile.custom_rules}\n`;
        }
        basePrompt += `CRITICAL: You MUST adhere to these risk parameters when advising the user or executing tools. If a requested action violates these parameters (e.g., buying a high-risk memecoin when 'Avoid Memecoins' is YES), you MUST warn the user and refuse execution unless they explicitly override.\n`;
      }
      
      if (personas.length > 0) {
        basePrompt += `\nObserved Traits (Dialectic Modeling):\n`;
        personas.forEach(p => {
          basePrompt += `- ${p.trait} (Confidence: ${(p.confidence * 100).toFixed(0)}%)\n`;
        });
        basePrompt += `Adapt your tone, vocabulary, and suggestions to align with these observed user traits.\n`;
      }
    }
  } catch {}

  return basePrompt;
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
  
  // ── Opsi B: Keyword Pre-Check (Deterministik, tanpa LLM) ──────────────────
  // Cek keyword OS terlebih dahulu. Jika cocok, langsung route ke 'os'
  // tanpa memanggil LLM router untuk hemat latency & mencegah misklasifikasi.
  const OS_KEYWORDS = [
    // File & Dokumen
    'excel', 'xlsx', 'spreadsheet', 'laporan excel', 'generate excel', 'buat excel',
    'file', 'folder', 'direktori', 'directory', 'baca file', 'tulis file', 'edit file',
    'read file', 'write file', 'pdf', 'word', 'docx', 'dokumen', 'document',
    // Terminal & Git
    'terminal', 'command', 'shell', 'bash', 'script', 'run command', 'jalankan',
    'git', 'commit', 'push', 'pull', 'clone', 'branch', 'merge',
    // Web & Search
    'cari di web', 'search web', 'google', 'browse', 'scrape', 'web search',
    'cuaca', 'weather', 'berita', 'news',
    // Email & Workspace
    'email', 'gmail', 'google docs', 'google sheets', 'notion',
    'kalender', 'calendar',
    // Social & Media
    'twitter', 'tweet', 'x post', 'transcribe', 'audio', 'rekaman',
    // AI Settings
    'ganti nama', 'ubah nama', 'rename agent', 'ubah persona', 'change persona',
    'update profile', 'update identity', 'setting', 'pengaturan',
    // Summarize
    'ringkas', 'summarize', 'rangkum',
  ];

  // Keyword Web3 yang eksplisit — dipastikan tidak salah route ke 'os'
  const WEB3_KEYWORDS = [
    // Transaksi
    'swap', 'bridge', 'transfer', 'kirim', 'send', 'buy', 'sell', 'beli', 'jual',
    'mint', 'stake', 'unstake', 'claim', 'deposit', 'withdraw', 'approve',
    // Aset & Wallet
    'token', 'crypto', 'coin', 'nft', 'wallet', 'dompet', 'address', 'alamat',
    'eth', 'bnb', 'usdt', 'usdc', 'sol', 'matic', 'arb', 'op', 'base',
    // DeFi & Market
    'defi', 'dex', 'liquidity', 'pool', 'aave', 'uniswap', 'apy', 'apr',
    'harga', 'price', 'chart', 'market', 'portfolio', 'balance', 'saldo',
    'gas', 'fee', 'slippage', 'transaction', 'transaksi', 'tx',
    // Chain
    'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'mainnet', 'testnet',
    'on-chain', 'blockchain',
  ];

  let context: 'web3' | 'os' | 'general' = 'general';
  let preCheckMatched = false;

  // Cek OS keywords dulu (prioritas lebih tinggi untuk mencegah misklasifikasi)
  if (OS_KEYWORDS.some(kw => lowerInput.includes(kw))) {
    context = 'os';
    preCheckMatched = true;
  } else if (WEB3_KEYWORDS.some(kw => lowerInput.includes(kw))) {
    context = 'web3';
    preCheckMatched = true;
  }

  if (preCheckMatched) {
    console.log(pc.cyan(`[Orchestrator] Intent pre-classified (keyword match) as: ${context.toUpperCase()}`));
  } else {
    // ── Fallback: LLM Router (untuk intent ambigu / percakapan umum) ─────────
    const routerPrompt = `You are Nyxora's Semantic Intent Router. Your job is to classify the user's FINAL message into one of three categories: 'web3', 'os', or 'general'.
Rules:
1. FOCUS ONLY ON THE FINAL MESSAGE. History is only for context.
2. The user may speak in ANY language, including casual slang, idioms, or abbreviations (e.g., 'tf', 'wd', 'buy', 'sell'). Translate their core intent logically.
3. If the core intent involves blockchain, crypto, bridging, swapping, trading, sending/receiving, tokens, wallets, or transactions, reply 'web3'.
4. If the core intent involves OS automation, web search, weather, emails, files, excel, terminal, or changing AI settings, reply 'os'.
5. If it is purely casual conversation, chit-chat, or greetings, reply 'general'.
Reply with EXACTLY ONE WORD: web3, os, or general.`;

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
        
        if (contextResponse.includes('web3')) context = 'web3';
        else if (contextResponse.includes('os')) context = 'os';
        else context = 'general';
    } catch (e) {
        console.warn(`[Orchestrator] Router LLM failed, falling back to general. Error:`, e);
        context = 'general';
    }

    console.log(pc.magenta(`[Orchestrator] Intent classified as: ${context.toUpperCase()}`));
  }
  
  if (context === 'web3') {
      return await processWeb3Intent(input, role, onProgress, sessionId);
  } else if (context === 'os') {
      return await processOsIntent(input, role, onProgress, sessionId);
  } else {
      // General Agent: Use osAgent logic but without execution tools to save tokens.
      // Wait, osAgent has activeTools. We can just route to osAgent for now, but general agent shouldn't have tools.
      // Let's create a dummy general intent processing directly here.
      logger.addEntry({ role, content: input }, sessionId);
      
      const messages = [
        { role: 'system', content: getSystemPrompt('general') },
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
          if (finalContent.includes('<think>')) {
            finalContent = finalContent.replace(/<think>[\s\S]*?\n\n/i, '');
            finalContent = finalContent.replace(/<think>[\s\S]*$/i, '');
          }
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

    const OS_KEYWORDS = [
      'excel', 'xlsx', 'spreadsheet', 'file', 'folder', 'direktori', 'directory',
      'read file', 'write file', 'pdf', 'word', 'docx', 'dokumen', 'document',
      'terminal', 'command', 'shell', 'bash', 'script', 'run command', 'jalankan',
      'git', 'commit', 'push', 'pull', 'clone', 'branch', 'merge',
      'cari di web', 'search web', 'google', 'browse', 'scrape', 'web search',
      'cuaca', 'weather', 'berita', 'news',
      'email', 'gmail', 'google docs', 'google sheets', 'notion', 'kalender', 'calendar',
      'twitter', 'tweet', 'transcribe', 'audio',
      'ganti nama', 'ubah nama', 'rename agent', 'setting', 'pengaturan',
      'ringkas', 'summarize', 'rangkum',
    ];

    const WEB3_KEYWORDS = [
      'swap', 'bridge', 'transfer', 'kirim', 'send', 'buy', 'sell', 'beli', 'jual',
      'mint', 'stake', 'unstake', 'claim', 'deposit', 'withdraw', 'approve',
      'token', 'crypto', 'coin', 'nft', 'wallet', 'dompet', 'address',
      'eth', 'bnb', 'usdt', 'usdc', 'sol', 'matic', 'arb', 'op', 'base',
      'defi', 'dex', 'liquidity', 'pool', 'aave', 'uniswap', 'apy', 'apr',
      'harga', 'price', 'chart', 'market', 'portfolio', 'balance', 'saldo',
      'gas', 'fee', 'slippage', 'transaction', 'transaksi', 'tx',
      'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'mainnet', 'testnet',
      'on-chain', 'blockchain',
    ];

    let context: 'web3' | 'os' | 'general' = 'general';
    let preCheckMatched = false;

    const pendingTxs = txManager.getPending();
    if (pendingTxs.length > 0) {
      context = 'web3';
      preCheckMatched = true;
    } else if (OS_KEYWORDS.some(kw => lowerInput.includes(kw))) {
      context = 'os';
      preCheckMatched = true;
    } else if (WEB3_KEYWORDS.some(kw => lowerInput.includes(kw))) {
      context = 'web3';
      preCheckMatched = true;
    }

    if (!preCheckMatched) {
      const routerPrompt = `You are Nyxora's Semantic Intent Router. Classify the user's FINAL message into: 'web3', 'os', or 'general'. Reply with EXACTLY ONE WORD.`;
      const routerMessages = [
        { role: 'system', content: routerPrompt },
        ...textOnlyHistory.slice(-10),
        { role: 'user', content: input }
      ];
      try {
        const routerResponse = await executeWithRetry(async (client) =>
          client.chat({ model: config.llm.model, messages: routerMessages as any, temperature: 0.1, max_tokens: 10 })
        , 3);
        const cr = (routerResponse.message.content || 'general').toLowerCase().trim();
        if (cr.includes('web3')) context = 'web3';
        else if (cr.includes('os')) context = 'os';
        else context = 'general';
      } catch {
        context = 'general';
      }
    }

    console.log(pc.cyan(`[Stream Orchestrator] Intent classified as: ${context.toUpperCase()}`));

    let finalResult = '';
    if (context === 'web3') {
      finalResult = await processWeb3IntentStream(input, onChunk, onProgress, sessionId);
    } else if (context === 'os') {
      finalResult = await processOsIntentStream(input, onChunk, onProgress, sessionId);
    } else {
      logger.addEntry({ role: 'user', content: input }, sessionId);
      const messages = [
        { role: 'system', content: getSystemPrompt('general') },
        ...textOnlyHistory,
        { role: 'user', content: input }
      ];
      try {
        let streamedContent = '';
        const response = await executeWithRetry(async (client) =>
          client.stream(
            { model: config.llm.model, messages: messages as any },
            (chunk: string) => { streamedContent += chunk; onChunk(chunk); }
          )
        );
        let finalContent = response.message?.content || streamedContent || '';
        finalContent = finalContent
          .replace(/<(think|thought)[\s\S]*?<\/\1>\n?/gi, '')
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
