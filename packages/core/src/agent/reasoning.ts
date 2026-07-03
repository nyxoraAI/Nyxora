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
async function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'general', userInput: string = ''): Promise<string> {
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
CRITICAL RULE: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt, UNLESS the Episodic Memories or Cognitive Skills specify a strict language preference.
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
CRITICAL RULE: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt, UNLESS the Episodic Memories or Cognitive Skills specify a strict language preference.
CRITICAL RULE 3: FILE SYSTEM SAFETY. You are STRICTLY FORBIDDEN from modifying config.yaml, rpc_key.yaml, or policy.yaml using terminal commands like sed or echo.
CRITICAL RULE 4: CRON JOBS VS LIMIT ORDERS. Do NOT use schedule_task for price-based trading triggers. Use schedule_task for time-based recurring tasks.
CRITICAL RULE 5: TOOL CONFIDENCE. NEVER fabricate file contents or command outputs.`;
    } else {
      basePrompt = `You are Nyxora's General Agent.
The current real-world date and time is: ${currentDateTime}.

CRITICAL: You MUST use a Chain of Thought approach for every response. Enclose your reasoning within <think>...</think> tags.
IMPORTANT: The <think> block is strictly for internal monologue. Your final answer must be OUTSIDE and AFTER the </think> tag.

[GENERAL WORKFLOW]
CRITICAL RULE 1: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt, UNLESS the Episodic Memories or Cognitive Skills specify a strict language preference.
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

  // Inject Episodic Memories via Python RAG
  try {
    const ragRes = await fetch('http://127.0.0.1:8000/memory/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userInput, top_k: 5 })
    });
    if (ragRes.ok) {
      const ragData = await ragRes.json();
      if (ragData.memories && ragData.memories.length > 0) {
        basePrompt += `\n\n--- EPISODIC MEMORIES (SMART SUGGESTIONS) ---\n`;
        ragData.memories.forEach((mem: string) => {
          basePrompt += `- ${mem}\n`;
        });
      }
    }
  } catch (e) {
    // Fallback or ignore if Python ML engine is down
  }

  // V3: Inject Personalized Risk Profile
  try {
    const profile = logger.getUserProfile();
    
    if (profile) {
      basePrompt += `\n\n--- [USER_PERSONA] RISK PROFILE & PREFERENCES ---\n`;
      basePrompt += `Risk Level: ${profile.risk_level}\n`;
      basePrompt += `Max Slippage Tolerance: ${profile.max_slippage}%\n`;
      basePrompt += `Avoid Memecoins: ${profile.avoid_memecoins ? 'YES' : 'NO'}\n`;
      if (profile.custom_rules) {
        basePrompt += `Custom Rules: ${profile.custom_rules}\n`;
      }
      basePrompt += `CRITICAL: You MUST adhere to these risk parameters when advising the user or executing tools. If a requested action violates these parameters (e.g., buying a high-risk memecoin when 'Avoid Memecoins' is YES), you MUST warn the user and refuse execution unless they explicitly override.\n`;
    }
  } catch {}

  // HIGHEST PRIORITY: Inject observed user communication style.
  // This section is placed LAST so it overrides any default tone rules above (including IDENTITY.md).
  try {
    // Only use traits with confidence >= 0.5 (confirmed by multiple audit cycles)
    const strongPersonas = episodicDB.getStrongPersonas(0.5);
    
    if (strongPersonas.length > 0) {
      basePrompt += `\n\n--- ⚡ OVERRIDE: USER COMMUNICATION STYLE (HIGHEST PRIORITY — OVERRIDES ALL RULES ABOVE) ---\n`;
      basePrompt += `CRITICAL: These are CONFIRMED user preferences observed across multiple conversations. You MUST apply them IMMEDIATELY and CONSISTENTLY, overriding any default tone or style instructions above.\n\n`;
      
      strongPersonas.forEach(p => {
        const label = p.category ? `[${p.category.toUpperCase()}]` : '[PREFERENCE]';
        basePrompt += `${label} ${p.trait}\n`;
      });
      
      basePrompt += `\nMANDATORY ENFORCEMENT:\n`;
      basePrompt += `- You MUST adapt your tone, language, and style to match the detected user preferences above.\n`;
      basePrompt += `- If the user communicates informally or casually → respond casually. Do NOT be formal or robotic.\n`;
      basePrompt += `- If the user communicates in a specific language or dialect → respond in that same language/style.\n`;
      basePrompt += `- If the user uses slang or informal words → mirror that vocabulary naturally.\n`;
      basePrompt += `- This is a HARD RULE. It overrides any default tone in IDENTITY.md or other instructions above.\n`;
    }
  } catch {}

  return basePrompt;
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
  // Files & Documents
  'excel', 'xlsx', 'spreadsheet', 'generate excel',
  'file', 'folder', 'directory', 'read file', 'write file', 'pdf', 'word', 'docx', 'document',
  // Terminal & Git
  'terminal', 'command', 'shell', 'bash', 'script', 'run command',
  'git', 'commit', 'push', 'pull', 'clone', 'branch', 'merge',
  // Web & Search
  'search web', 'google', 'browse', 'scrape', 'weather', 'news',
  // Email & Workspace
  'email', 'gmail', 'google docs', 'google sheets', 'notion', 'calendar',
  // Social & Media
  'twitter', 'tweet', 'x post', 'transcribe', 'audio',
  // AI Settings
  'rename agent', 'change persona', 'update profile', 'update identity', 'setting',
  // Summarization
  'summarize',
];

const WEB3_KEYWORDS: string[] = [
  // Transactions
  'swap', 'bridge', 'transfer', 'send', 'buy', 'sell',
  'mint', 'stake', 'unstake', 'claim', 'deposit', 'withdraw', 'approve',
  // Assets & Wallets
  'token', 'crypto', 'coin', 'nft', 'wallet', 'address',
  'eth', 'bnb', 'usdt', 'usdc', 'sol', 'matic', 'arb', 'op', 'base',
  // DeFi & Market
  'defi', 'dex', 'liquidity', 'pool', 'aave', 'uniswap', 'apy', 'apr',
  'price', 'chart', 'market', 'portfolio', 'balance',
  'gas', 'fee', 'slippage', 'transaction', 'tx',
  // Chains
  'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'mainnet', 'testnet',
  'on-chain', 'blockchain',
  // Fiat & Currency
  'usd', 'eur', 'gbp', 'jpy', 'aud', 'idr', 'fiat', 'currency', 'convert', 'exchange', 'rate', 'value',
];



// ── P2: Multi-Intent Decomposer ─────────────────────────────────────────────
/**
 * Detects if the user message contains BOTH web3 AND os intents.
 * Returns 'compound' when both are present so we can route to both agents.
 */
function detectCompoundIntent(
  lowerInput: string,
  osKeywords: string[],
  web3Keywords: string[]
): { hasOs: boolean; hasWeb3: boolean } {
  return {
    hasOs: osKeywords.some(kw => lowerInput.includes(kw)),
    hasWeb3: web3Keywords.some(kw => lowerInput.includes(kw)),
  };
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
            content: `You are a task planning assistant for a crypto AI agent.
The user has a complex request that needs structured execution.
Break it down into a clear, ordered execution plan with 3-6 concrete steps.
Each step should map to a specific action or tool call.
Be concise. Use bullet points. No fluff.
Context domain: ${context}`
          },
          { role: 'user', content: `Create an execution plan for: ${input}` }
        ]
      })
    );
    const plan = planRes.message?.content?.trim() || '';
    if (!plan) return '';
    console.log(pc.blue('[TaskPlanner] Plan generated, injecting into agent context.'));
    return `\n\n--- 📋 TASK EXECUTION PLAN (follow this order) ---\n${plan}\n--- END PLAN ---\n`;
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
  if (compound.hasWeb3 && compound.hasOs) {
    console.log(pc.cyan('[Orchestrator] Compound intent detected (web3 + os). Running both agents sequentially.'));
    logger.addEntry({ role, content: input }, sessionId);
    const [web3Result, osResult] = await Promise.allSettled([
      processWeb3Intent(input, role, onProgress, sessionId),
      processOsIntent(input, role, onProgress, sessionId),
    ]);
    const parts: string[] = [];
    if (web3Result.status === 'fulfilled' && web3Result.value) parts.push(web3Result.value);
    if (osResult.status === 'fulfilled' && osResult.value) parts.push(osResult.value);
    return parts.join('\n\n---\n\n') || '⚠️ Both agents returned empty responses.';
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
    const routerPrompt = `You are Nyxora's Semantic Intent Router. Your job is to classify the user's FINAL message into one of three categories: 'web3', 'os', or 'general'.
Rules:
1. FOCUS ONLY ON THE FINAL MESSAGE. History is only for context.
2. The user may speak in ANY language, including casual slang, idioms, or abbreviations.
3. If the core intent involves blockchain, crypto, bridging, swapping, trading, sending/receiving, tokens, wallets, transactions, OR asking for the price/conversion of ANY asset to fiat, reply 'web3'.
4. If the core intent involves OS automation, weather, emails, files, terminal, changing AI settings, OR asking ANY question that requires a web search or real-world factual lookup (e.g., 'who won the game', 'what is the registration date', 'cek info', 'cari tahu'), reply 'os'.
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
      // P7: Inject task plan for complex requests
      const planInjection = shouldPlan(input) ? await runTaskPlanner(input, 'web3') : '';
      if (planInjection) {
        // Prepend plan as a system note in the input so agent sees it
        return await processWeb3Intent(planInjection + '\n\nUSER REQUEST: ' + input, role, onProgress, sessionId);
      }
      return await processWeb3Intent(input, role, onProgress, sessionId);
  } else if (context === 'os') {
      const planInjection = shouldPlan(input) ? await runTaskPlanner(input, 'os') : '';
      if (planInjection) {
        return await processOsIntent(planInjection + '\n\nUSER REQUEST: ' + input, role, onProgress, sessionId);
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
      console.log(pc.cyan('[Stream Orchestrator] Compound intent detected (web3 + os).'));
      logger.addEntry({ role: 'user', content: input }, sessionId);
      const [web3R, osR] = await Promise.allSettled([
        processWeb3IntentStream(input, onChunk, onProgress, sessionId),
        processOsIntentStream(input, onChunk, onProgress, sessionId),
      ]);
      const parts: string[] = [];
      if (web3R.status === 'fulfilled' && web3R.value) parts.push(web3R.value);
      if (osR.status === 'fulfilled' && osR.value) parts.push(osR.value);
      return parts.join('\n\n---\n\n') || '⚠️ Both agents returned empty responses.';
    } else if (streamCompound.hasOs) {
      context = 'os';
      preCheckMatched = true;
    } else if (streamCompound.hasWeb3) {
      context = 'web3';
      preCheckMatched = true;
    }

    if (!preCheckMatched) {
      const routerPrompt = `You are Nyxora's Semantic Intent Router. Your job is to classify the user's FINAL message into one of three categories: 'web3', 'os', or 'general'.
Rules:
1. FOCUS ONLY ON THE FINAL MESSAGE. History is only for context.
2. The user may speak in ANY language, including casual slang, idioms, or abbreviations.
3. If the core intent involves blockchain, crypto, bridging, swapping, trading, sending/receiving, tokens, wallets, transactions, OR asking for the price/conversion of ANY asset to fiat, reply 'web3'.
4. If the core intent involves OS automation, weather, emails, files, terminal, changing AI settings, OR asking ANY question that requires a web search or real-world factual lookup (e.g., 'who won the game', 'what is the registration date', 'cek info', 'cari tahu'), reply 'os'.
5. If it is purely casual conversation, chit-chat, or greetings, reply 'general'.
Reply with EXACTLY ONE WORD: web3, os, or general.`;
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
      // P7: Inject task plan for complex stream requests
      const planInjection = shouldPlan(input) ? await runTaskPlanner(input, 'web3') : '';
      const streamInput = planInjection ? planInjection + '\n\nUSER REQUEST: ' + input : input;
      finalResult = await processWeb3IntentStream(streamInput, onChunk, onProgress, sessionId);
    } else if (context === 'os') {
      const planInjection = shouldPlan(input) ? await runTaskPlanner(input, 'os') : '';
      const streamInput = planInjection ? planInjection + '\n\nUSER REQUEST: ' + input : input;
      finalResult = await processOsIntentStream(streamInput, onChunk, onProgress, sessionId);
    } else {
      logger.addEntry({ role: 'user', content: input }, sessionId);
      const messages = [
        { role: 'system', content: await getSystemPrompt('general', input) },
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
