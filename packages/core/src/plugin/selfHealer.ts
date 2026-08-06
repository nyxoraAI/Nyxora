import fs from 'fs';
import path from 'path';
import { executeWithRetry } from '../utils/llmUtils';
import { loadConfig } from '../config/parser';
import pc from 'picocolors';

/**
 * Error categories that are fixable via code patching.
 * Network errors, missing API keys, permission issues, etc. cannot be healed.
 */
const HEALABLE_ERROR_PATTERNS = [
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /is not a function/i,
  /is not defined/i,
  /Cannot read propert/i,
  /Cannot destructure/i,
  /is not iterable/i,
  /Unexpected token/i,
  /has no exported member/i,
  /does not provide an export/i,
  /Module not found/i,
];

function isHealableError(errorMessage: string): boolean {
  return HEALABLE_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
}

/**
 * Extracts the best code block from LLM response.
 * Prefers the LAST (largest) typescript/js block to avoid grabbing
 * an explanation snippet that appears before the real fix.
 */
function extractCodeBlock(text: string): string | null {
  const regex = /```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/gi;
  let lastMatch: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[1].trim().length > lastMatch?.length!) {
      lastMatch = match[1].trim();
    }
  }

  if (lastMatch) return lastMatch;

  // Fallback: raw dump (model skipped backticks)
  if (text.includes('import ') || text.includes('export ')) {
    return text.trim();
  }

  return null;
}

/**
 * Attempts to autonomously heal a broken skill script by feeding the source code,
 * the input parameters, and the runtime error to a Medic LLM for patching.
 */
export async function attemptSelfHeal(
  skillName: string,
  scriptPath: string,
  args: any,
  errorMessage: string
): Promise<boolean> {
  if (!fs.existsSync(scriptPath)) {
    console.warn(`[SelfHealer] Cannot heal ${skillName}: Script path not found at ${scriptPath}`);
    return false;
  }

  // Bug #5 fix: Don't waste an LLM call on un-healable runtime errors
  if (!isHealableError(errorMessage)) {
    console.warn(`[SelfHealer] Skipping heal for '${skillName}' — error is not code-fixable: ${errorMessage}`);
    return false;
  }

  const config = loadConfig();
  console.log(pc.yellow(`[SelfHealer] 🩺 Medic Agent activated for '${skillName}'!`));
  console.log(pc.dim(`[SelfHealer] Error intercepted: ${errorMessage}`));

  try {
    const sourceCode = fs.readFileSync(scriptPath, 'utf-8');

    // Construct Medic Prompt
    const systemPrompt = `You are the Nyxora Medic Agent, an elite TypeScript debugger.
Your sole purpose is to FIX broken NodeJS scripts that fail at runtime.
You must output ONLY the corrected TypeScript source code inside a \`\`\`typescript block.
Do NOT output any conversational text. Do NOT provide explanations. JUST the code block.`;

    const userPrompt = `A script named '${skillName}' has failed during execution.

### ORIGINAL SOURCE CODE:
\`\`\`typescript
${sourceCode}
\`\`\`

### EXECUTION ARGUMENTS:
\`\`\`json
${JSON.stringify(args, null, 2)}
\`\`\`

### RUNTIME ERROR:
${errorMessage}

Fix the source code to resolve this error. Return the ENTIRE fixed file.`;

    // Bug #1 fix: Don't pass max_tokens — it's provider-specific and not part
    // of the shared client.chat() interface. Temperature is sufficient to control output.
    const response = await executeWithRetry(async (client) => {
      return await client.chat({
        model: config.llm.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      });
    });

    const responseText = response.message?.content || '';

    // Bug #3 fix: Use the last (largest) code block, not the first
    const patchedCode = extractCodeBlock(responseText);

    if (!patchedCode) {
      throw new Error('Medic Agent did not return a recognizable code block.');
    }

    // Bug #4 fix: Broaden sanity check — accept CommonJS module.exports style too
    const hasExecuteExport =
      patchedCode.includes('export async function execute') ||
      patchedCode.includes('export function execute') ||
      patchedCode.includes('export default') ||
      patchedCode.includes('module.exports');

    if (!hasExecuteExport) {
      throw new Error('Patched code is missing the required execute/default export.');
    }

    // Overwrite the original script
    fs.writeFileSync(scriptPath, patchedCode, 'utf-8');

    console.log(pc.green(`[SelfHealer] 💉 Successfully patched and saved '${skillName}'!`));
    return true;

  } catch (err: any) {
    console.error(pc.red(`[SelfHealer] ❌ Medic Agent failed to heal '${skillName}': ${err.message}`));
    return false;
  }
}
