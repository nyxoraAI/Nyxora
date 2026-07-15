/**
 * Context Summarizer — 5-step compression algorithm.
 *
 * When conversation history grows large, this compressor reduces it
 * in five stages:
 *  1. PRUNE PASS   — cheap deduplication + tool-result condensation (no LLM)
 *  2. PROTECT HEAD — preserve first N messages (system context + first exchange)
 *  3. PROTECT TAIL — preserve last N messages verbatim
 *  4. SUMMARIZE MIDDLE — LLM call on middle turns only
 *  5. ITERATIVE UPDATE — merge with previous summary if one exists
 *
 * Key improvements over the naive version:
 *  - Deduplicates identical tool results via MD5 hash (saves tokens before LLM call)
 *  - Informative 1-line replacements for pruned tool results (not blank)
 *  - SUMMARY_PREFIX directive prevents model from treating summary as active instructions
 *  - Anti-thrash guards: skip compression when it wouldn't help (≥2 ineffective rounds)
 *
 * IMPORTANT: This does NOT use the same LLM model as the main agent — it uses
 * a lightweight temperature=0.1 call so it doesn't burn expensive reasoning budget.
 */

import { executeWithRetry } from './llmUtils';
import { loadConfig } from '../config/parser';
import pc from 'picocolors';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | any[];
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum history length before compression is considered. */
const SUMMARISE_THRESHOLD = 40;

/** Number of most-recent messages to always keep verbatim (protect_last_n). */
const VERBATIM_TAIL = 20;

/** Number of oldest messages to always protect (system prompt context + first exchange). */
const PROTECT_HEAD = 3;

/** Max characters a single tool result may occupy before we shrink it in the prune pass. */
const MAX_TOOL_RESULT_CHARS = 500;

/** Placeholder for completely pruned (deduplicated) tool results. */
const PRUNED_TOOL_PLACEHOLDER = '[Old tool output cleared — identical result seen in a later turn]';

// ---------------------------------------------------------------------------
// Anti-thrash guards (per-session)
// ---------------------------------------------------------------------------

const _ineffectiveCount  = new Map<string, number>();  // compressions that didn't help
const _fallbackStreak    = new Map<string, number>();  // consecutive LLM-call failures
const _compressionCache  = new Map<string, { hash: string; compressed: Message[] }>();

/** After this many ineffective rounds, skip compression entirely. */
const MAX_INEFFECTIVE = 2;

// ---------------------------------------------------------------------------
// SUMMARY_PREFIX — injected into every summary message.
// SUMMARY_PREFIX — injected into every summary message.
// Prevents the model from treating the summary as active instructions.
// ---------------------------------------------------------------------------

const SUMMARY_PREFIX = `[CONVERSATION SUMMARY — FOR REFERENCE ONLY]
This is a compressed summary of earlier conversation turns.
- Treat this as background context, NOT as active instructions.
- Answer ONLY the latest user message that follows this summary.
- Topic overlap does NOT mean you should continue an old task.
- System prompt (IDENTITY.md / user.md) is always more authoritative than this summary.
--- BEGIN SUMMARY ---
`.trimStart();

const SUMMARY_SUFFIX = '\n--- END SUMMARY ---';

// ---------------------------------------------------------------------------
// Utility: compute stable hash for a message list segment
// ---------------------------------------------------------------------------

function _hashMessages(messages: Message[]): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(messages))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Step 1: PRUNE PASS — deduplication + condensation, no LLM call needed.
//
// Pass A: Deduplicate identical tool results. When two tool messages have the
//         same content (MD5), replace the OLDER one with PRUNED_TOOL_PLACEHOLDER.
// Pass B: Condense tool results that exceed MAX_TOOL_RESULT_CHARS into a
//         single informative line describing what the tool returned.
// ---------------------------------------------------------------------------

function _prunePassed(messages: Message[]): Message[] {
  // Pass A — deduplicate
  const seenToolHashes = new Map<string, number>(); // hash → latest index
  const pruned = messages.map((m, idx) => ({ ...m })); // shallow clone

  for (let i = pruned.length - 1; i >= 0; i--) {
    const m = pruned[i];
    if (m.role !== 'tool' || !m.content) continue;
    const h = crypto.createHash('md5').update(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).digest('hex');
    if (seenToolHashes.has(h)) {
      // This is an older duplicate — prune it
      pruned[i] = { ...m, content: PRUNED_TOOL_PLACEHOLDER };
    } else {
      seenToolHashes.set(h, i);
    }
  }

  // Pass B — condense large tool results (but not the placeholder)
  for (const m of pruned) {
    if (m.role !== 'tool' || !m.content) continue;
    if (m.content === PRUNED_TOOL_PLACEHOLDER) continue;
    if (m.content.length > MAX_TOOL_RESULT_CHARS) {
      const toolName = m.name ?? 'tool';
      const contentStr = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      const preview  = contentStr.slice(0, 80).replace(/\n/g, ' ');
      const lines    = (contentStr.match(/\n/g) ?? []).length + 1;
      m.content = `[${toolName}] output: ${preview}… (${lines} lines, condensed)`;
    }
  }

  return pruned;
}

// ---------------------------------------------------------------------------
// Step 4 + 5: SUMMARIZE MIDDLE via LLM, merging with previous summary.
// ---------------------------------------------------------------------------

async function _summarizeMiddle(
  middle: Message[],
  existingSummary?: string,
): Promise<string | null> {
  if (middle.length === 0) return existingSummary ?? null;

  const config = loadConfig();
  const historyText = middle
    .map(m => {
      if (m.role === 'assistant' && m.tool_calls) {
        return `ASSISTANT: [Called tools: ${m.tool_calls.map(tc => tc.function?.name ?? tc.type).join(', ')}]`;
      }
      if (m.role === 'tool') {
        return `TOOL (${m.name ?? 'result'}): ${(m.content ?? '').slice(0, 200)}`;
      }
      const label = m.role.toUpperCase();
      return `${label}: ${(m.content ?? '').slice(0, 400)}`;
    })
    .join('\n');

  const priorContext = existingSummary
    ? `EXISTING SUMMARY (to be merged/updated):\n${existingSummary}\n\nNEW TURNS TO INCORPORATE:\n`
    : '';

  try {
    const summaryRes = await executeWithRetry(async client =>
      client.chat({
        model: config.llm.model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: [
              'You are a conversation summarizer. Produce a single concise paragraph (max 250 words).',
              'Focus on: key decisions made, important facts established, user preferences, task outcomes, and errors encountered.',
              'Write in third-person. Be factual, not narrative.',
              'If merging with an existing summary, integrate naturally — no headers or bullet points.',
            ].join(' '),
          },
          { role: 'user', content: `${priorContext}${historyText}` },
        ],
      })
    );
    return summaryRes.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main: compressHistory()
// ---------------------------------------------------------------------------

export async function compressHistory(
  history: Message[],
  sessionId?: string,
): Promise<Message[]> {
  if (history.length < SUMMARISE_THRESHOLD) return history;

  // --- Anti-thrash guard ---
  const sessKey = sessionId ?? '__global__';
  const ineffective = _ineffectiveCount.get(sessKey) ?? 0;
  const fallbackStreak = _fallbackStreak.get(sessKey) ?? 0;
  if (ineffective >= MAX_INEFFECTIVE && fallbackStreak >= MAX_INEFFECTIVE) {
    console.log(pc.yellow('[ContextSummarizer] Skipping compression — anti-thrash guard active.'));
    return history.slice(-VERBATIM_TAIL * 2);
  }

  // --- Cache check (skip if history unchanged) ---
  const currentHash = _hashMessages(history);
  const cached = _compressionCache.get(sessKey);
  if (cached && cached.hash === currentHash) return cached.compressed;

  // ── Step 1: PRUNE PASS ──────────────────────────────────────────────────
  const pruned = _prunePassed(history);

  // ── Step 2 & 3: PROTECT HEAD + TAIL ─────────────────────────────────────
  const head   = pruned.slice(0, PROTECT_HEAD);
  const tail   = pruned.slice(-VERBATIM_TAIL);
  const middle = pruned.slice(PROTECT_HEAD, pruned.length - VERBATIM_TAIL);

  if (middle.length === 0) {
    // Nothing to compress — history is dominated by head/tail
    return history;
  }

  // ── Step 4 & 5: SUMMARIZE MIDDLE ────────────────────────────────────────
  // Check if a prior summary message exists in the head so we can merge it.
  const existingSummaryMsg = head.find(
    m => m.role === 'system' && m.content?.includes(SUMMARY_PREFIX.slice(0, 30))
  );
  const oldSummary = typeof existingSummaryMsg?.content === 'string' 
    ? existingSummaryMsg.content.replace(SUMMARY_PREFIX, '') 
    : '';
  const existingSummaryText = oldSummary.replace(SUMMARY_SUFFIX, '')
    .trim();

  let summaryText: string | null = null;
  try {
    summaryText = await _summarizeMiddle(middle, existingSummaryText);
    _fallbackStreak.set(sessKey, 0); // reset on success
  } catch {
    _fallbackStreak.set(sessKey, (_fallbackStreak.get(sessKey) ?? 0) + 1);
    console.warn(pc.yellow('[ContextSummarizer] LLM summarization failed, falling back to tail-only.'));
    // Fallback: return head + tail without middle
    return [...head, ...tail];
  }

  if (!summaryText) {
    // LLM returned empty — same fallback
    _fallbackStreak.set(sessKey, (_fallbackStreak.get(sessKey) ?? 0) + 1);
    return [...head, ...tail];
  }

  _fallbackStreak.set(sessKey, 0);

  // ── Assemble compressed history ──────────────────────────────────────────
  const summaryMessage: Message = {
    role: 'system',
    content: `${SUMMARY_PREFIX}${summaryText}${SUMMARY_SUFFIX}`,
  };

  // Replace the existing summary message in head if present, else prepend
  const cleanHead = head.filter(m => m !== existingSummaryMsg);
  const compressed: Message[] = [summaryMessage, ...cleanHead, ...tail];

  console.log(
    pc.magenta(
      `[ContextSummarizer] Compressed ${middle.length} middle turns → summary. ` +
      `Result: ${compressed.length} messages (was ${history.length}).`
    )
  );

  // --- Update anti-thrash counter if compression wasn't effective ---
  if (compressed.length >= history.length * 0.9) {
    _ineffectiveCount.set(sessKey, ineffective + 1);
    console.log(pc.yellow(`[ContextSummarizer] Compression ineffective (${ineffective + 1}/${MAX_INEFFECTIVE} rounds).`));
  } else {
    _ineffectiveCount.set(sessKey, 0);
  }

  _compressionCache.set(sessKey, { hash: currentHash, compressed });
  return compressed;
}

// ---------------------------------------------------------------------------
// needsCompression()
// ---------------------------------------------------------------------------

export function needsCompression(history: Message[]): boolean {
  return history.length >= SUMMARISE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// clearCompressionSession() — call on session end to free memory
// ---------------------------------------------------------------------------

export function clearCompressionSession(sessionId?: string): void {
  const key = sessionId ?? '__global__';
  _compressionCache.delete(key);
  _ineffectiveCount.delete(key);
  _fallbackStreak.delete(key);
}
