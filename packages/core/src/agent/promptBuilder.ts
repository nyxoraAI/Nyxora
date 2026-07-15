import fs from 'fs';
import os from 'os';
import { getPath } from '../config/paths';
import { cognitiveManager } from '../cognitive/cognitiveManager';
import { episodicDB } from '../memory/episodic';
import { scanContextContent } from './threatPatterns';
import { findNyxoraMd, stripYamlFrontmatter } from './workspaceUtils';
import { detectProjectFacts, buildWorkspaceBlock } from './projectAnalyzer';

// ── TTL Caches ──────────────────────────────────────────────────────────────
// Narrative memory + skills are fetched from the ML engine on every request.
// These change rarely (only when user explicitly updates memory), so we cache
// them for 30 seconds to avoid blocking the critical path on every message.
const NARRATIVE_TTL_MS = 30_000;
const narrativeCache = new Map<string, { data: string; ts: number }>();

// Skills list is even more stable; same TTL is fine.
const skillsCache: { data: string; ts: number } | null = null;
let _skillsCache: { data: string; ts: number } | null = null;

// Short-lived build cache: if the same agentType + userInput key is built
// within 5 seconds (router warm-up + agent call happen near-simultaneously),
// the second call returns the cached result instantly.
const BUILD_CACHE_TTL_MS = 5_000;
const buildCache = new Map<string, { result: string | Promise<string>; ts: number }>();

export interface PromptBuilderOptions {
  agentType: 'os' | 'web3' | 'general';
  userInput: string;
  config: any;
  platform?: string; // e.g., 'telegram', 'cli'
  modelFamily?: 'openai' | 'google' | 'grok' | 'anthropic' | 'unknown';
  sessionId?: string;
}

export class PromptBuilder {
  public buildSystemPrompt(options: PromptBuilderOptions): Promise<string> {
    // Short-lived build cache: prevents double-build when the router warm-up
    // and the agent's own getSystemPrompt() call happen within 5 seconds.
    const cacheKey = `${options.agentType}:${options.userInput.slice(0, 80)}:${options.sessionId || ''}`;
    const cached = buildCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < BUILD_CACHE_TTL_MS) {
      return Promise.resolve(cached.result);
    }

    const buildPromise = (async () => {

    // 1. Stable Tier (sync — no I/O)
    const stableParts = [
      this.buildIdentity(options),
      this.buildUniversalDiscipline(),
      this.buildModelSpecificSteering(options.modelFamily),
      this.buildDomainDiscipline(options.agentType),
      this.buildMemoryGuidance(),
      this.buildSkillsGuidance(),
    ];

    if (options.agentType === 'os') {
      stableParts.push(this.buildComputerUseGuidance());
    }

    // 2. Context Tier (sync — file I/O only)
    // Resolve working directory (project workspace if active, else undefined)
    const workDir = await this._resolveWorkDir(options.sessionId);
    const contextParts = [
      this.buildGitWorkspaceContext(),
      this.buildActiveCognitiveSkills(options.userInput),
      // Coding posture: only injected when a project workspace is active
      options.agentType === 'os' ? this.buildCodingPosture(workDir) : '',
    ];

    // 3. Volatile Tier — PARALLELIZED
    // buildEpisodicMemories and buildNarrativeMemories both make network calls
    // to the ML engine. Running them concurrently cuts ~300-600ms off every request.
    const [
      episodicMemories,
      narrativeMemories,
    ] = await Promise.all([
      this.buildEpisodicMemories(options.userInput),
      this.buildNarrativeMemories(options.agentType),
    ]);

    const volatileParts = [
      episodicMemories,
      narrativeMemories,
      this.buildPlaybookContext(),
      this.buildUserPreferencesAndIdentity(options.sessionId),
      this.buildSecurityPolicy(),
      this.buildRiskProfile(),
      this.buildNyxDaemonPersonas(),
    ];

    const allParts = [
      ...stableParts,
      ...contextParts,
      ...volatileParts
    ].filter(p => p && p.trim() !== '');

    const result = allParts.join('\n\n');

    // Update cache with resolved string
    buildCache.set(cacheKey, { result, ts: Date.now() });

    return result;
    })();
    
    // Store promise immediately to prevent race conditions
    buildCache.set(cacheKey, { result: buildPromise, ts: Date.now() });
    return buildPromise;
  }

  private buildIdentity(options: PromptBuilderOptions): string {
    const { agentType, config } = options;
    let identity = '';
    
    if (agentType === 'web3') {
      identity = `You are Nyxora's Web3 Agent (DeFi Specialist).\nCurrent Time: ${new Date().toISOString()}\nDefault Chain: ${config?.agent?.default_chain || 'base'}`;
      identity += `\n\nCRITICAL: Think carefully before acting. NEVER output your internal reasoning, thinking process, or planning steps into the response. Output ONLY your final answer. Your internal reasoning process (if supported by your model) will be handled securely by the API.`;
      identity += `\n\n[WEB3 EXECUTION WORKFLOW]
CRITICAL RULE 1: NEVER expose internal JSON tool calls. Explain the outcome naturally.
CRITICAL RULE 2: STRICT LANGUAGE MATCHING. Reply in the exact same language as the user's LATEST prompt, UNLESS the Episodic Memories or Cognitive Skills specify a strict language preference.
CRITICAL RULE 3: DEFAULT CHAIN HANDLING. Default to: ${config?.agent?.default_chain || 'base'} unless specified.
CRITICAL RULE 4: CONDITIONAL PARALLEL EXECUTION. Parallel tool execution is ONLY allowed if there are zero data dependencies.
CRITICAL RULE 5: TRANSACTION EXECUTION. For ALL state-changing transactions (swap, bridge, transfer), execute IMMEDIATELY. It will trigger a secure popup.
CRITICAL RULE 6: NETWORK SAFETY VALIDATION. NEVER GUESS chains or tokens. Ask for confirmation if ambiguous. Supported MAINNETS include: ethereum, base, bsc, arbitrum, optimism, polygon, and robinhood. If a user asks to check "all networks" or "mainnets", you MUST include 'robinhood'.
CRITICAL RULE 7: TOOL CONFIDENCE & HALUCINATION PREVENTION. NEVER fabricate blockchain data.
CRITICAL RULE 8: AMOUNT PRECISION. Use 6 decimal places for precision, or 2 if >$10,000.
CRITICAL RULE 9: MARKET CONFIDENCE SCORE. Declare a 'Confidence Score (0-100%)' internally. Warn if < 40%.`;
    } else {
      const _now = new Date();
      const _tz   = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // ISO 8601 is universally understood regardless of locale
      const _iso  = _now.toISOString();
      // Format using the system's own locale so the date looks natural to any user
      const _localDate = _now.toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const _localTime = _now.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
      identity = `You are Nyxora's OS Agent (Local System Automation Specialist).
Current Context: Date: ${_localDate} | Time: ${_localTime} | TZ: ${_tz} | ISO: ${_iso}
CRITICAL: When the user refers to "today", "hari ini", or any equivalent, they mean the date above. ALWAYS include this exact date in search_web queries.

[CRITICAL EXECUTION RULES]
1. OUTPUT RESTRICTION: Output ONLY your final natural language answer or direct tool calls. NEVER leak internal JSON payload syntax or raw planning steps into the chat response.
2. THINKING GATE: Before calling ANY tool that modifies/deletes files or executes code (write_local_file, edit_local_file, run_terminal_command, etc.), you MUST format your thoughts inside <think>...</think> tags. Keep your reasoning extremely brief (max 3 sentences) to conserve output tokens. If your model has native thinking, still emit these tags but keep it short.
3. HARD HARDENING: You are STRICTLY FORBIDDEN from reading, modifying, or deleting config.yaml, rpc_key.yaml, and policy.yaml. This applies to ALL tools (terminal, file writers, sed, echo, cat). If requested, refuse flatly.
4. LOCAL PRIVILEGE: You run locally on the user's physical machine. You have full access via tools. Never claim cloud limitations or privacy restrictions. Act immediately.
5. NO SILENT TURNS: Every turn MUST end with either a native tool call or a visible final text response. Empty outputs are a system failure.

[TERMINAL & SUDO STRATEGY]
- Use 'run_terminal_command' ONLY for non-interactive, non-sudo reads/actions (ls, pip install, git).
- Use 'run_terminal_command_pty' for ALL commands requiring 'sudo' or interactive inputs (vim, apt).
- Always append '-y' and prefix with 'DEBIAN_FRONTEND=noninteractive' for apt commands. 
- Do not prompt for sudo password; the PTY tool handles it automatically from security.sudo_password. If it fails, stop and tell the user to check their config.yaml. Do not retry blindly.`;
    }

    return identity;
  }

  private buildUniversalDiscipline(): string {
    return `<execution_discipline>
[INTERACTIVE EXECUTION FLOW]
1. SUCCESS / INITIATION PATH:
   - When a tool call is required to fulfill a request, you SHOULD prepend exactly ONE short, natural, and casual sentence (max 12 words) explaining what you are about to do (e.g., "Gue cek portofolio lo dulu ya, tunggu bentar.", "Siap, gue cari dokumentasinya di web dulu.").
   - Immediately follow this single sentence with the native tool call in the SAME turn. Do NOT make the user wait or click anything.

2. FAILURE / RECOVERY PATH:
   - If a tool fails or returns unhelpful data, you MAY output exactly ONE short conversational sentence acknowledging the issue.
   - You MUST immediately retry using a DIFFERENT strategy or CORRECTED parameters in the SAME turn.
   - CRITICAL: NEVER repeat the exact same tool call with the exact same arguments if it previously failed or returned unhelpful data.

3. HARD CONSTRAINTS FOR BOTH PATHS:
   - Max ONE sentence of conversational text per turn before/between tools. 
   - Never output text-only responses if a recoverable tool action or next-step execution is possible.
   - Text and tool calls MUST be emitted together in the exact same turn.
   - ANTI-LOOP: Max 2 retries per task. If you are stuck or data is still missing after 2 attempts, STOP looping, admit the limitation, and ask the user for help.
   - Only ask the user for input when additional information or authorization is genuinely required.

[ADDITIONAL DISCIPLINE]
- [LIVE STATE ONLY] Treat your internal knowledge base as deprecated for dynamic data. Portfolio, balances, market rates, asset prices, file structures, and system stats MUST be fetched via live tools every single time.
- [ANTI-LOOP] Max 2 retries/refinements for web searches or failed tool arguments. If data is missing or empty after 2 attempts, STOP, admit the limitation, and ask the user for specific parameters or clarification. Do not loop aggressively.
- [REAL FACTS] For current events, schedules, or facts (especially years 2024-2026), search_web is mandatory. No guessing, no approximations, no inferences. If sources conflict, state the discrepancy explicitly.
- [TIME ZONE & DATE HANDLING] Never assume a timezone. Identify the original timezone explicitly provided by the source (e.g., UTC, GMT, WIB). Convert only after confirmation. Account for DST.
- [CONVERSATIONAL SANITY] Do not simulate multi-turn conversations in your output. Do not ask a question and answer it yourself. If you ask the user a question, stop generating immediately and wait.
- [DATA BEFORE FILE] If ordered to create a file containing factual/real-world data, you MUST call search_web FIRST in a prior turn to verify the data before calling the file-writing tool.
- [PARALLEL TOOL CALLS] Batch independent reads, searches, and read-only commands into a single assistant turn. Only serialize when a true data dependency exists.
- [ACT DONT ASK] When a question has an obvious default interpretation, act on it immediately via tools instead of asking for clarification.
</execution_discipline>`;
  }

  private buildModelSpecificSteering(modelFamily?: string): string {
    if (modelFamily === 'google') {
      return `# Google model operational directives
Follow these operational rules strictly:
- **Absolute paths:** Always construct and use absolute file paths for all file system operations. Combine the project root with relative paths.
- **Verify first:** Use read_file/search_files to check file contents and project structure before making changes. Never guess at file contents.
- **Dependency checks:** Never assume a library is available. Check package.json, requirements.txt, Cargo.toml, etc. before importing.
- **Conciseness:** Keep explanatory text brief — a few sentences, not paragraphs. Focus on actions and results over narration.
- **Non-interactive commands:** Use flags like -y, --yes, --non-interactive to prevent CLI tools from hanging on prompts.
- **Keep going:** Work autonomously until the task is fully resolved. Don't stop with a plan — execute it.`;
    } else if (modelFamily === 'openai' || modelFamily === 'grok') {
      return `# OpenAI/Grok Execution discipline
<mandatory_tool_use_gpt>
NEVER answer these from memory or mental computation — ALWAYS use a tool:
- Arithmetic, math, calculations → use terminal or execute_code
- Hashes, encodings, checksums → use terminal (e.g. sha256sum, base64)
- Current time, date, timezone → use terminal (e.g. date)
- System state: OS, CPU, memory, disk, ports, processes → use terminal
- File contents, sizes, line counts → use read_file, search_files, or terminal
- Git history, branches, diffs → use terminal
- Current facts (weather, news, versions) → use web_search
Your memory and user profile describe the USER, not the system you are running on.
</mandatory_tool_use_gpt>`;
    }
    return '';
  }

  private buildDomainDiscipline(agentType: string): string {
    if (agentType === 'web3') {
      return `<mandatory_tool_use>
NEVER answer the following using only your internal memory — ALWAYS use the relevant tool:
- Cryptocurrency prices, market data, and portfolio values (use get_price_and_fiat_value)
- Fiat exchange rates or currency conversions
- Arithmetic, math, calculations
- Real-world current events
</mandatory_tool_use>

<fiat_conversion_rule>
CRITICAL: If the user asks for the total fiat value of a certain amount of crypto, you MUST pass that amount into the 'get_price_and_fiat_value' tool's 'amount' parameter.
Leave the 'currency' parameter BLANK unless the user explicitly requests a specific currency, allowing the system default to apply.
NEVER fetch the price and manually multiply it in your head. The LLM is prohibited from performing fiat multiplication.
NEVER use the 'analyze_market' tool for basic fiat conversions.
</fiat_conversion_rule>`;
    } else {
      return `<mandatory_tool_use>
NEVER answer the following from internal memory — ALWAYS use a tool:
- Arithmetic, math, calculations → run_terminal_command (python3 -c "print(...)")
- System state: OS version, RAM, CPU, processes → run_terminal_command
- File contents, sizes, line counts → read_local_file or search_files
- Git history, branch, diffs → run_terminal_command
- Real-world current events, factual queries → search_web
Models that skip this rule produce HALLUCINATIONS. There are no exceptions.
</mandatory_tool_use>

<web_search_accuracy>
When using the search_web tool to look up news, current events, or factual data:
1. NEVER pass casual, conversational, or highly localized queries directly to the tool.
2. ALWAYS optimize the query into a specific search query in the user's original language.
3. Use depth: 2 (deep research) for anything requiring high factual accuracy.
4. Construct specific queries using full entity names, relevant year/version, and intent-specific keywords ("official", "confirmed", "documentation").
5. Prioritize official websites, government docs, and reputable news sources.
</web_search_accuracy>

<act_dont_ask_os>
For harmless commands (e.g. ls, cat, checking system info), CALL the tool directly without asking for confirmation.
CRITICAL: For ANY command that modifies the system (e.g., sudo, apt-get, install, rm), you MUST ask the user for explicit permission FIRST.
When asking for permission, simply ask: "Do you want me to run [command]?" and STOP.
Once the user replies "yes", you MUST immediately emit the tool call to execute the command.
</act_dont_ask_os>

<working_directory_rule>
CRITICAL: When creating, writing, or moving ANY file, determine the absolute path using this priority order:
1. Use the working directory explicitly stated by the user in THIS conversation.
2. If the user has a preferred working directory in their profile, use THAT path.
3. Default to the user's HOME directory (e.g., /home/username/) and ask for confirmation. Never assume a hardcoded path.
</working_directory_rule>`;
    }
  }

  private buildComputerUseGuidance(): string {
    const isMac = os.platform() === 'darwin';
    const isWindows = os.platform() === 'win32';
    
    const osName = isMac ? 'macOS' : (isWindows ? 'Windows' : 'Linux');
    const shareLine = isMac 
        ? "focus, or Space. You and the user can share the same Mac at the same time.\n\n"
        : "focus, or active window. You and the user can share the same desktop at the same time.\n\n";
    const saveCombo = isMac ? 'cmd+s' : 'ctrl+s';
    
    let offscreenLine = '';
    if (isMac) {
      offscreenLine = "- If an element you need is on a different Space or behind another window, the driver still clicks it — no need to switch Spaces.\n\n";
    } else if (isWindows) {
      offscreenLine = "- If an element is behind another window, the driver still clicks it — no need to raise it. Some apps may still force foreground behavior internally.\n\n";
    } else {
      offscreenLine = "- If an element is behind another window, the driver still clicks it — no need to raise it.\n\n";
    }

    const exampleApp = isMac ? 'Safari' : (isWindows ? 'Chrome' : 'Firefox');

    return `# Computer Use (${osName} background control)\n` +
        `You have a \`computer_use\` tool that drives the ${osName} desktop in the BACKGROUND — your actions do not steal the user's cursor, keyboard ` +
        shareLine +
        `## Preferred workflow\n` +
        `1. Call \`computer_use\` with \`action='capture'\` to get a screenshot and element tree.\n` +
        `2. For text input, \`action='type', text='...'\`. For key combos \`action='key', keys='${saveCombo}'\`.\n\n` +
        `## Background mode rules\n` +
        `- When capturing, prefer \`app='${exampleApp}'\` (or whichever app the task is about) instead of the whole screen.\n` +
        offscreenLine;
  }

  private buildMemoryGuidance(): string {
    return `<memory_guidance>
Save durable facts using memory or profile tools: user preferences, environment details, tool quirks. Keep it compact.
Do NOT save task progress, session outcomes, or temporary TODO states.
Write memories as declarative facts, not instructions to yourself ('User prefers concise responses' ✓ — 'Always respond concisely' ✗).
</memory_guidance>`;
  }

  private buildSkillsGuidance(): string {
    return `<skills_guidance>
After completing a complex task, fixing a tricky error, or discovering a non-trivial workflow, consider saving the approach as a Cognitive Skill or Playbook if your tools allow it. Update it if it becomes outdated.
</skills_guidance>`;
  }

  private buildGitWorkspaceContext(): string {
    try {
      const nyxoraMdPath = findNyxoraMd(process.cwd());
      if (nyxoraMdPath) {
        let content = fs.readFileSync(nyxoraMdPath, 'utf8');
        content = stripYamlFrontmatter(content);
        content = scanContextContent(content, nyxoraMdPath);
        return `--- PROJECT CONTEXT (${nyxoraMdPath}) ---\n${content}`;
      }
    } catch (e) {
      // Ignore if no git root or no file
    }
    return '';
  }

  // ── Coding Posture ────────────────────────────────────────────
  // Injected into the context tier only when a project workspace is active
  // (workDir is non-null). Contains workspace facts + coding guidelines.

  private async _resolveWorkDir(sessionId?: string): Promise<string | null> {
    if (!sessionId) return null;
    try {
      const { Logger } = require('../memory/logger');
      const localLogger = new Logger();
      const session = localLogger.getSession(sessionId);
      if (session?.project_id) {
        const project = localLogger.getProject(session.project_id);
        if (project?.path) return project.path as string;
      }
    } catch { /* ignore */ }
    return null;
  }

  private buildCodingPosture(workDir: string | null): string {
    if (!workDir) return '';

    // Scan project facts — cheap, no LLM call
    const facts = detectProjectFacts(workDir);
    const workspaceBlock = facts ? buildWorkspaceBlock(facts) : `--- WORKSPACE ---\nRoot: ${workDir}`;

    // Read context files (AGENTS.md / .cursorrules) and inject verbatim
    const contextFileContent = (facts?.contextFiles ?? []).map(name => {
      try {
        const p = require('path').join(workDir, name);
        let content = fs.readFileSync(p, 'utf8').trim();
        content = scanContextContent(content, p);
        return `--- ${name} (operator instructions — HIGHEST PRIORITY) ---\n${content}`;
      } catch { return ''; }
    }).filter(Boolean).join('\n\n');

    const codingGuidance = [
      '--- CODING POSTURE (active because a project workspace is loaded) ---',
      'You are pair-programming inside the user\'s codebase. Operate like a careful senior engineer.',
      '',
      '[GATHER CONTEXT FIRST, THEN ACT]',
      '- ALWAYS use `read_local_file` to read relevant files BEFORE making any change.',
      '  Never guess file contents or invent function/module names.',
      '- ALWAYS use `search_files` to locate a symbol definition or find where a function is used',
      '  BEFORE concluding it does not exist. Trace symbols to their definitions.',
      '- Batch independent lookups in a SINGLE turn (parallel tool calls) — do not serialize them.',
      '- Never invent files, symbols, APIs, or imports you have not seen in the repo.',
      '  Check the project manifest (package.json / pyproject.toml / Cargo.toml) before assuming',
      '  a library is available.',
      '',
      '[MAKE CHANGES VIA TOOLS, NOT CHAT]',
      '- ALWAYS edit files using `edit_local_file` or `write_local_file`.',
      '  NEVER print code blocks to the user as a substitute for editing — apply the change, then',
      '  summarise what you did. Only show code when the user explicitly asks to see it.',
      '- Match the project\'s existing style and conventions.',
      '  Instructions in AGENTS.md / .cursorrules / Nyxora.md already in context WIN over your defaults.',
      '- Touch only what the task requires. Do not drive-by refactor, rename, or reformat',
      '  code that is unrelated to the task.',
      '- If a patch fails to apply, re-read the file to get exact current contents before retrying.',
      '  Do not repeat a stale patch. If the same region fails twice, rewrite the enclosing',
      '  function or whole file with `write_local_file` instead.',
      '',
      '[VERIFY BEFORE CLAIMING DONE]',
      '- Use `run_terminal_command` for git, builds, tests, and linting. Run the relevant',
      '  tests/linter/build and confirm they PASS before stating the work is complete.',
      '- Terminal state PERSISTS across calls: current directory and exported environment',
      '  variables carry forward. Activate a virtualenv or export setup vars once,',
      '  then reuse that state instead of re-sourcing before every test command.',
      '- Fix root causes, not symptoms: when you find a bug, check sibling code paths for the',
      '  same flaw and fix the class, not just the reported site.',
      '- When fixing linter/type errors on a file, stop after about three attempts on the same',
      '  file and ask the user rather than looping.',
      '- Track multi-step work with `todo_write` and check progress with `todo_read`.',
      '',
      '[RESPECT THE REPO]',
      '- Do not commit, push, or rewrite git history unless explicitly asked.',
      '- Do not read, print, or commit secrets — leave .env and credential files alone.',
    ].join('\n');

    const parts = [workspaceBlock, codingGuidance];
    if (contextFileContent) parts.push(contextFileContent);
    return parts.join('\n\n');
  }

  private buildActiveCognitiveSkills(userInput: string): string {
    const activeSOP = cognitiveManager.loadActiveCognitiveSkills(userInput);
    if (activeSOP) {
      return `[ACTIVE COGNITIVE SKILLS]\n${activeSOP}`;
    }
    return '';
  }

  private async buildEpisodicMemories(userInput: string): Promise<string> {
    try {
      // 1.5s timeout: if ML engine is still starting up, fail fast rather than
      // blocking the entire system prompt build for tens of seconds.
      const ragRes = await fetch('http://127.0.0.1:8000/memory/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userInput, top_k: 5 }),
        signal: AbortSignal.timeout(1500)
      });
      if (ragRes.ok) {
        const ragData = await ragRes.json();
        if (ragData.memories && ragData.memories.length > 0) {
          return `--- EPISODIC MEMORIES (SMART SUGGESTIONS) ---\n` + ragData.memories.map((m: string) => `- ${m}`).join('\n');
        }
      }
    } catch (e) {
      // Ignore if Python ML engine is down or timed out
    }
    return '';
  }

  private async buildNarrativeMemories(agentType: string): Promise<string> {
    if (agentType === 'web3') return '';

    // TTL cache: narrative memory and skills list change only when the user
    // explicitly saves something — re-fetching every 30s is more than enough.
    const now = Date.now();
    const narrativeCached = narrativeCache.get('narrative');
    const skillsCached = _skillsCache;

    const fetchNarrative = async (): Promise<string> => {
      if (narrativeCached && now - narrativeCached.ts < NARRATIVE_TTL_MS) {
        return narrativeCached.data;
      }
      try {
        // 1.5s timeout: fail fast if ML engine is not yet ready at cold start
        const narrativeRes = await fetch('http://127.0.0.1:8000/memory/narrative', {
          signal: AbortSignal.timeout(1500)
        });
        if (!narrativeRes.ok) return narrativeCached?.data ?? '';
        const { memory_md, user_md } = await narrativeRes.json();
        let part = '';
        if (memory_md) part += `--- DURABLE MEMORY (ENVIRONMENT & WORKFLOWS) ---\n${memory_md}\n\n`;
        if (user_md)   part += `--- ABOUT THE USER ---\n${user_md}\n\n`;
        narrativeCache.set('narrative', { data: part, ts: now });
        return part;
      } catch {
        return narrativeCached?.data ?? '';
      }
    };

    const fetchSkills = async (): Promise<string> => {
      if (skillsCached && now - skillsCached.ts < NARRATIVE_TTL_MS) {
        return skillsCached.data;
      }
      try {
        // 1.5s timeout: fail fast if ML engine is not yet ready at cold start
        const skillsRes = await fetch('http://127.0.0.1:8000/skills/list', {
          signal: AbortSignal.timeout(1500)
        });
        if (!skillsRes.ok) return skillsCached?.data ?? '';
        const skillsData = await skillsRes.json();
        let part = '';
        if (skillsData.skills && skillsData.skills.length > 0) {
          part += `--- ACQUIRED SKILLS ---\nAvailable self-learned skills:\n`;
          skillsData.skills.forEach((s: any) => {
            part += `- ${s.name}: ${s.description}\n`;
          });
        }
        _skillsCache = { data: part, ts: now };
        return part;
      } catch {
        return skillsCached?.data ?? '';
      }
    };

    // Parallelize both fetches — they are independent of each other
    const [narrativePart, skillsPart] = await Promise.all([
      fetchNarrative(),
      fetchSkills(),
    ]);

    return narrativePart + skillsPart;
  }

  private buildPlaybookContext(): string {
    try {
      const { list_playbooks } = require('../system/skills/playbookManager');
      const playbooks = list_playbooks();
      if (playbooks && playbooks.length > 0) {
        return `--- AVAILABLE PLAYBOOKS/SKILLS ---\nThese are the names of playbooks you can access via the \`search_playbook\` tool:\n${playbooks.map((p: string) => `- ${p}`).join('\n')}\nIf the user asks you to use any of these tools or execute these workflows, call \`search_playbook\` with the tool name to read the instructions before doing anything else.`;
      }
    } catch (error) {
      // Ignore
    }
    return '';
  }

  private buildSecurityPolicy(): string {
    try {
      const policyPath = getPath('policy.yaml');
      if (fs.existsSync(policyPath)) {
        const yaml = require('yaml'); 
        const file = fs.readFileSync(policyPath, 'utf8');
        const parsed = yaml.parse(file) || {};
        if (parsed.custom_llm_rules && Array.isArray(parsed.custom_llm_rules) && parsed.custom_llm_rules.length > 0) {
          return `--- SECURITY POLICY (MANDATORY RULES) ---\n${parsed.custom_llm_rules.map((r: string) => `* ${r}`).join('\n')}\n\nCRITICAL: If the user asks you to perform an action that violates the Security Policy above, YOU MUST NOT EXECUTE IT DIRECTLY. Instead, ask for their explicit permission first.`;
        }
      }
    } catch (error) {
      // Ignore
    }
    return '';
  }

  private buildRiskProfile(): string {
    try {
      const { Logger } = require('../memory/logger');
      const logger = new Logger();
      const profile = logger.getUserProfile();
      if (profile) {
        let result = `--- [USER_PERSONA] RISK PROFILE & PREFERENCES ---\n`;
        result += `Risk Level: ${profile.risk_level}\n`;
        result += `Max Slippage Tolerance: ${profile.max_slippage}%\n`;
        result += `Avoid Memecoins: ${profile.avoid_memecoins ? 'YES' : 'NO'}\n`;
        if (profile.custom_rules) {
          result += `Custom Rules: ${profile.custom_rules}\n`;
        }
        result += `CRITICAL: You MUST adhere to these risk parameters when advising the user or executing tools. If a requested action violates these parameters (e.g., buying a high-risk memecoin when 'Avoid Memecoins' is YES), you MUST warn the user and refuse execution unless they explicitly override.\n`;
        return result;
      }
    } catch (error) {
      // Ignore
    }
    return '';
  }

  private buildUserPreferencesAndIdentity(sessionId?: string): string {
    let result = '';
    const identityMdPath = getPath('IDENTITY.md');
    const userMdPath = getPath('user.md');
    let isFirstTime = false;
    
    try {
      const identityContent = fs.existsSync(identityMdPath) ? fs.readFileSync(identityMdPath, 'utf8').trim() : '';
      let userContent = fs.existsSync(userMdPath) ? fs.readFileSync(userMdPath, 'utf8').trim() : '';
      
      const isIdentityDefault = !identityContent || identityContent.includes('You are a Web3 AI assistant named Nyxora.');
      const isUserDefault = !userContent || userContent.includes('Write custom instructions, special rules, user profiles');
      
      isFirstTime = isIdentityDefault && isUserDefault;

      if (isFirstTime) {
        return `[ONBOARDING MODE]
This is your VERY FIRST interaction with the user. You MUST warmly welcome them to Nyxora and ask for 4 things to initialize your setup:
1. Their Name
2. What they want to name YOU (the AI Agent)
3. Their Hobbies or Job (so you can tailor your conversation context)
4. Your Persona/Character (e.g., professional, sarcastic, JARVIS, anime waifu)
Do NOT perform any web3 tasks or generic answers until they provide all 4 details. Once they answer, use 'update_profile' to save their name and hobbies/job to user.md, and use 'update_identity' (making sure to provide the 'agentName' parameter!) to save your new name and persona to IDENTITY.md.`;
      }

      if (identityContent) {
        result += `--- CORE IDENTITY & PERSONA ---\n${identityContent}\n\n`;
      }
      if (userContent) {
        userContent = scanContextContent(userContent, userMdPath);

        // Auto-extract preferred working directory and inject as a top-level directive
        // so the LLM always resolves file paths correctly without needing to search memory.
        let inferredWorkDir = '';
        
        // 1. Check if session belongs to a project workspace
        if (sessionId) {
          try {
            const { Logger } = require('../memory/logger');
            const localLogger = new Logger();
            const session = localLogger.getSession(sessionId);
            if (session && session.project_id) {
              const project = localLogger.getProject(session.project_id);
              if (project) {
                inferredWorkDir = project.path;
              }
            }
          } catch (e) {}
        }
        
        // 2. Fallback to user preferences if no project is active
        if (!inferredWorkDir) {
          const wdMatch = userContent.match(/(?:prefers?|preferred|working directory|workspace|store|simpan|direktori)[^.\n]*?([`'"]?(\/[^\s`'"]+)[`'"]?)/i);
          if (wdMatch && wdMatch[2]) {
            inferredWorkDir = wdMatch[2].replace(/[`'"]/g, '').trim();
          }
        }
        
        if (inferredWorkDir) {
          result += `--- ⚠️ USER WORKING DIRECTORY (MANDATORY) ---\n`;
          result += `CRITICAL: The current workspace directory for ALL file operations is: ${inferredWorkDir}\n`;
          result += `You MUST use this as the base path when constructing absolute paths for write_local_file, edit_local_file, run_terminal_command (mkdir, cp, mv, ls), etc.\n`;
          result += `Example: to save "report.md", use "${inferredWorkDir}/report.md" — NOT a relative path, NOT the Nyxora install directory.\n\n`;
        }

        result += `--- LOCAL USER INFORMATION & PREFERENCES ---\n${userContent}\n\n`;
      }
    } catch (e) {
      // Ignore error
    }
    
    return result;
  }


  private buildNyxDaemonPersonas(): string {
    try {
      const strongPersonas = episodicDB.getStrongPersonas(0.5);
      if (strongPersonas.length > 0) {
        let result = `--- ⚡ OVERRIDE: USER COMMUNICATION STYLE (HIGHEST PRIORITY — OVERRIDES ALL RULES ABOVE) ---\n`;
        result += `CRITICAL: These are CONFIRMED user preferences observed across multiple conversations. You MUST apply them IMMEDIATELY and CONSISTENTLY, overriding any default tone or style instructions above.\n\n`;
        strongPersonas.forEach(p => {
          const label = p.category ? `[${p.category.toUpperCase()}]` : '[PREFERENCE]';
          result += `${label} ${p.trait}\n`;
        });
        return result;
      }
    } catch (e) {}
    return '';
  }
}

export const promptBuilder = new PromptBuilder();
