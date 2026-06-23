import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { LLMProvider, OpenAIAdapter, AnthropicAdapter, GeminiAdapter } from './llmProvider';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig, loadApiKeys } from '../config/parser';
import { Logger } from '../memory/logger';
import { Tracker } from '../gateway/tracker';
import { episodicDB } from '../memory/episodic';


import { getPath } from '../config/paths';
import pc from 'picocolors';

export const logger = new Logger();



import { getOpenAI, executeWithRetry } from '../utils/llmUtils';


function getSystemPrompt(context: 'web3' | 'os' | 'general' = 'general'): string {
    const config = loadConfig();
    const currentDateTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
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
  } catch (error) {
    // Ignore db errors if not initialized
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
  } catch (e) {
    // Ignore if db not ready
  }

  return basePrompt;
}



import { processWeb3Intent } from './web3Agent';
import { processOsIntent } from './osAgent';

export async function processUserInput(input: string, role: 'user' | 'system' = 'user', onProgress?: (msg: string) => void, sessionId?: string): Promise<string> {
  const lowerInput = input.toLowerCase();
  
  const config = loadConfig();
  const history = logger.getHistory(sessionId);
  
  // Filter history to text-only for Router & General agent to prevent Gemini 400 Invalid Argument
  const textOnlyHistory = history
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content || "" }));
  
  const routerPrompt = `You are Nyxora's Semantic Intent Router. Your job is to classify the user's FINAL message into one of three categories: 'web3', 'os', or 'general'.
Rules:
1. FOCUS ONLY ON THE FINAL MESSAGE. History is only for resolving pronouns (e.g., "buy it").
2. If the final message involves blockchain, crypto, bridging, swapping, tokens, or wallets, reply 'web3'.
3. If the final message involves fetching news, web search, weather, email, files, or terminal, reply 'os'.
4. If it's just casual conversation, reply 'general'.
Reply with EXACTLY ONE WORD.`;

  const routerMessages = [
      { role: 'system', content: routerPrompt },
      ...textOnlyHistory.slice(-4),
      { role: 'user', content: input }
  ];

  let context: 'web3' | 'os' | 'general' = 'general';
  try {
      const routerResponse = await executeWithRetry(async (client) => {
          return await client.chat({
              model: config.llm.model,
              messages: routerMessages as any,
              temperature: 0.1,
              max_tokens: 10
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
             finalContent = "⚠️ LLM mengembalikan respons kosong atau terputus. Hal ini biasanya terjadi karena fluktuasi koneksi API atau limitasi sesaat. Silakan coba lagi.";
          }
          
          logger.addEntry({ role: 'assistant', content: finalContent }, sessionId);
          return finalContent;
      } catch (error: any) {
          console.error("General LLM Error:", error);
          const status = error?.status || error?.response?.status;
          let errorMsg = '⚠️ Sistem sedang mengalami limitasi koneksi LLM (Rate Limit). Harap tunggu beberapa detik dan coba lagi.';
          
          if (status === 400 || (error.message && error.message.toLowerCase().includes('invalid'))) {
              errorMsg = '⚠️ Terjadi kesalahan. Format pesan atau alat (skill) tidak dimengerti oleh LLM.';
          }
          
          logger.addEntry({ role: 'assistant', content: errorMsg }, sessionId);
          return errorMsg;
      }
  }
}
