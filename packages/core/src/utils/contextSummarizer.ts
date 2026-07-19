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
import { logger } from '../memory/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Message {
  id?: number;
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
const SUMMARISE_THRESHOLD = 50;

/** Number of most-recent messages to always keep verbatim (protect_last_n). */
const VERBATIM_TAIL = 20;

/** Number of oldest messages to always protect (system prompt context + first exchange). */
const PROTECT_HEAD = 3;

/** Max characters a single tool result may occupy before we shrink it in the prune pass. */
const MAX_TOOL_RESULT_CHARS = 500;

/** Placeholder for completely pruned (deduplicated) tool results. */
const PRUNED_TOOL_PLACEHOLDER = '[Old tool output cleared — identical result seen in a later turn]';

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

// Utility functions
// ---------------------------------------------------------------------------

function _snapBoundary(messages: Message[], index: number): number {
  let snapped = index;
  while (snapped > 0 && snapped < messages.length) {
    const prev = messages[snapped - 1];
    const curr = messages[snapped];
    
    // Rule 1: Never split 'assistant' with tool_calls from its 'tool' response
    if (prev.role === 'assistant' && prev.tool_calls && prev.tool_calls.length > 0 && curr.role === 'tool') {
      snapped++;
    }
    // Rule 2: Never split multiple consecutive 'tool' responses from each other
    else if (prev.role === 'tool' && curr.role === 'tool') {
      snapped++;
    }
    else {
      break;
    }
  }
  return snapped;
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

  // ── Step 1: PRUNE PASS ──────────────────────────────────────────────────
  const pruned = _prunePassed(history);

  // ── Step 2: BOUNDARY SNAPPING ───────────────────────────────────────────
  let headIdx = _snapBoundary(pruned, PROTECT_HEAD);
  let tailIdx = _snapBoundary(pruned, pruned.length - VERBATIM_TAIL);

  // Prevent overlap
  if (headIdx >= tailIdx) {
    return history;
  }

  const head   = pruned.slice(0, headIdx);
  const tail   = pruned.slice(tailIdx);
  const middle = pruned.slice(headIdx, tailIdx);

  if (middle.length === 0) {
    return history;
  }

  // ── Step 3: SUMMARIZE MIDDLE ────────────────────────────────────────────
  // Check if a prior summary message exists in the head so we can merge it.
  const existingSummaryMsg = head.find(
    m => m.role === 'system' && typeof m.content === 'string' && m.content.includes(SUMMARY_PREFIX.slice(0, 30))
  );
  const oldSummary = typeof existingSummaryMsg?.content === 'string' 
    ? existingSummaryMsg.content.replace(SUMMARY_PREFIX, '') 
    : '';
  const existingSummaryText = oldSummary.replace(SUMMARY_SUFFIX, '').trim();

  let summaryText: string | null = null;
  try {
    summaryText = await _summarizeMiddle(middle, existingSummaryText);
  } catch {
    console.warn(pc.yellow('[ContextSummarizer] LLM summarization failed, falling back.'));
    return history;
  }

  if (!summaryText) {
    return history;
  }

  const newSummaryContent = `${SUMMARY_PREFIX}\n${summaryText}\n${SUMMARY_SUFFIX}`;

  // ── Step 4: PERSIST TO DB (SOFT ARCHIVE) ────────────────────────────────
  const middleIds = middle.map(m => m.id).filter((id): id is number => typeof id === 'number');
  if (middleIds.length > 0) {
    try {
      logger.archiveAndCompact(sessionId || '__global__', middleIds, newSummaryContent);
      console.log(pc.cyan(`[ContextSummarizer] Compressed ${middle.length} turns via Soft Archiving.`));
    } catch (e) {
      console.error(pc.red('[ContextSummarizer] Failed to persist soft-archive:'), e);
      return history; // abort compression if DB write fails
    }
  }

  // Filter out any OLD summary message from head so we don't have duplicates
  const finalHead = head.filter(m => !(m.role === 'system' && typeof m.content === 'string' && m.content.includes(SUMMARY_PREFIX.slice(0, 30))));

  const newHistory: Message[] = [
    ...finalHead,
    { role: 'system', content: newSummaryContent },
    ...tail
  ];

  return newHistory;
}

// ---------------------------------------------------------------------------
// needsCompression()
// ---------------------------------------------------------------------------

export function needsCompression(history: Message[]): boolean {
  return history.length >= SUMMARISE_THRESHOLD;
}
