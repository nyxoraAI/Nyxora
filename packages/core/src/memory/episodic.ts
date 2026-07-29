import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { getAppDir } from '../config/paths';

// ---------------------------------------------------------------------------
// Semantic similarity helper — pure JS, zero deps.
// Computes Jaccard index on "meaningful" words (length > 3) between two strings.
// Returns a value between 0 (completely different) and 1 (identical meaning).
// ---------------------------------------------------------------------------
function wordOverlapSimilarity(a: string, b: string): number {
  const tokenise = (s: string) =>
    new Set(
      s.toLowerCase()
        .split(/[\W_]+/)
        .filter(w => w.length > 3)
    );
  const wa = tokenise(a);
  const wb = tokenise(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersection = 0;
  wa.forEach(w => { if (wb.has(w)) intersection++; });
  return intersection / Math.max(wa.size, wb.size);
}

export interface EpisodicMemory {
  id: number;
  fact: string;
  occurrences: number;
  confidence: number;
  category: string;
  rule_type: 'temporary' | 'permanent' | 'observation';
  key_topic?: string;
  lastSeen: string;
  createdAt: string;
}

export class EpisodicMemoryDB {
  private db: DatabaseSync;

  constructor() {
    const dataDir = path.join(getAppDir(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbPath = path.join(dataDir, 'episodic.db');
    this.db = new DatabaseSync(dbPath);
    // Enable WAL mode for concurrent multi-process reads/writes (Node + Python ML Engine)
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodic_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fact TEXT UNIQUE NOT NULL,
        occurrences INTEGER DEFAULT 1,
        confidence REAL DEFAULT 0.1,
        category TEXT DEFAULT 'general',
        rule_type TEXT DEFAULT 'observation',
        key_topic TEXT,
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_personas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trait TEXT UNIQUE NOT NULL,
        category TEXT DEFAULT 'general',
        confidence REAL DEFAULT 0.1,
        source TEXT,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: add category column if missing (for older DBs)
    try {
      this.db.prepare('ALTER TABLE user_personas ADD COLUMN category TEXT DEFAULT \'general\'').run();
    } catch {}
  }

  public addCandidateFact(
    fact: string,
    confidenceScore: number = 0.5,
    category: string = 'general',
    ruleType: 'temporary' | 'permanent' | 'observation' = 'observation',
    keyTopic?: string
  ): void {
    if (keyTopic) {
      this.invalidateTopic(keyTopic);
    }

    const cleanFact = fact.trim().replace(/[.!?]+$/, '');
    const safeScore = Math.min(1.0, confidenceScore);

    // ── Step 1: Exact / near-exact check (case-insensitive, trailing punct) ──
    const exactMatch = this.db.prepare(
      'SELECT id, occurrences, confidence FROM episodic_memories WHERE LOWER(fact) = ? OR LOWER(fact) = ?'
    ).get(cleanFact.toLowerCase(), cleanFact.toLowerCase() + '.') as any;

    if (exactMatch) {
      const newOcc  = exactMatch.occurrences + 1;
      const newConf = Math.min(1.0, exactMatch.confidence + safeScore * 0.2);
      this.db.prepare(
        'UPDATE episodic_memories SET occurrences = ?, confidence = ?, rule_type = ?, key_topic = ?, lastSeen = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(newOcc, newConf, ruleType, keyTopic ?? null, exactMatch.id);
      return;
    }

    // ── Step 2: Semantic near-duplicate check within the same category ────────
    // Fetch all facts in this category and compute word-overlap similarity.
    // Threshold: 0.60 — anything ≥ 60% similar is considered a duplicate.
    const SIMILARITY_THRESHOLD = 0.60;
    const peers = this.db.prepare(
      'SELECT id, fact, occurrences, confidence FROM episodic_memories WHERE category = ?'
    ).all(category) as any[];

    let bestMatch: any = null;
    let bestSim = 0;
    for (const peer of peers) {
      const sim = wordOverlapSimilarity(cleanFact, peer.fact);
      if (sim >= SIMILARITY_THRESHOLD && sim > bestSim) {
        bestSim = sim;
        bestMatch = peer;
      }
    }

    if (bestMatch) {
      // Merge into existing: increment occurrences and nudge confidence up.
      // Keep the higher-confidence fact text (prefer the older, more reinforced one).
      const newOcc  = bestMatch.occurrences + 1;
      const newConf = Math.min(1.0, Math.max(bestMatch.confidence, safeScore) + 0.05);
      this.db.prepare(
        'UPDATE episodic_memories SET occurrences = ?, confidence = ?, rule_type = ?, key_topic = ?, lastSeen = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(newOcc, newConf, ruleType, keyTopic ?? null, bestMatch.id);
      return;
    }

    // ── Step 3: No duplicate found — insert as new ────────────────────────────
    try {
      this.db.prepare(
        'INSERT INTO episodic_memories (fact, confidence, category, rule_type, key_topic) VALUES (?, ?, ?, ?, ?)'
      ).run(fact.trim(), safeScore, category, ruleType, keyTopic ?? null);
    } catch (e: any) {
      // UNIQUE constraint violation (race condition) — treat as exact match
      if (e.message?.includes('UNIQUE constraint failed')) {
        const dup = this.db.prepare('SELECT id, occurrences, confidence FROM episodic_memories WHERE fact = ?').get(fact.trim()) as any;
        if (dup) {
          const newOcc  = dup.occurrences + 1;
          const newConf = Math.min(1.0, dup.confidence + safeScore * 0.2);
          this.db.prepare(
            'UPDATE episodic_memories SET occurrences = ?, confidence = ?, lastSeen = CURRENT_TIMESTAMP WHERE id = ?'
          ).run(newOcc, newConf, dup.id);
        }
      } else {
        throw e;
      }
    }
  }

  public invalidateTopic(topic: string): void {
    if (!topic) return;
    const stmt = this.db.prepare('DELETE FROM episodic_memories WHERE key_topic = ?');
    stmt.run(topic);
  }

  public deleteMemoryByFact(factSubString: string): number {
    const stmt = this.db.prepare('DELETE FROM episodic_memories WHERE fact LIKE ?');
    const result = stmt.run(`%${factSubString}%`);
    // Need to cast to any because DatabaseSync returns an object { changes: number } 
    return (result as any).changes || 0;
  }

  public getMemories(): EpisodicMemory[] {
    const stmt = this.db.prepare('SELECT * FROM episodic_memories ORDER BY confidence DESC, lastSeen DESC');
    return stmt.all() as unknown as EpisodicMemory[];
  }

  public getPermanentMemories(): EpisodicMemory[] {
    // Fetch top 60 DISTINCT facts sorted by confidence and occurrences to capture both permanent rules and highly reinforced observations.
    // Limit set to 60 (not higher) to keep system prompt token usage reasonable — RAG episodic recall handles long-tail facts.
    const stmt = this.db.prepare(`
      SELECT fact, MAX(confidence) as confidence, MAX(occurrences) as occurrences, MAX(rule_type) as rule_type, MAX(lastSeen) as lastSeen
      FROM episodic_memories 
      GROUP BY fact 
      ORDER BY MAX(confidence) DESC, MAX(occurrences) DESC, MAX(lastSeen) DESC 
      LIMIT 60
    `);
    return stmt.all() as unknown as EpisodicMemory[];
  }

  public deleteMemory(id: number): void {
    const stmt = this.db.prepare('DELETE FROM episodic_memories WHERE id = ?');
    stmt.run(id);
  }

  public decayMemories(daysOld: number = 30, minConfidence: number = 0.5): void {
    // Delete single-occurrence observations that never got reinforced and are older than X days.
    // Threshold raised from (60d, 0.3) → (30d, 0.5) so stale one-off observations are cleaned up
    // more aggressively, keeping the DB lean while preserving well-reinforced facts.
    const stmt = this.db.prepare(`
      DELETE FROM episodic_memories 
      WHERE confidence < ? AND occurrences <= 1 AND lastSeen <= datetime('now', '-' || ? || ' days')
    `);
    stmt.run(minConfidence, daysOld);
  }

  public clearAllMemories(): void {
    const stmt = this.db.prepare('DELETE FROM episodic_memories');
    stmt.run();
  }

  public clearAllPersonas(): void {
    const stmt = this.db.prepare('DELETE FROM user_personas');
    stmt.run();
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }

  // --- PERSONA MODELING ---

  /**
   * Legacy method: upsert by exact trait string.
   * Kept for backward compatibility but prefer upsertPersonaByCategory.
   */
  public updatePersonaTrait(trait: string, confidence: number = 0.5, source: string = 'nyx_daemon'): void {
    const existing = this.db.prepare('SELECT id, confidence FROM user_personas WHERE trait = ?').get(trait) as any;
    
    if (existing) {
      const newConfidence = Math.min(1.0, existing.confidence + (confidence * 0.2));
      const stmt = this.db.prepare('UPDATE user_personas SET confidence = ?, source = ?, lastUpdated = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(newConfidence, source, existing.id);
    } else {
      const stmt = this.db.prepare('INSERT INTO user_personas (trait, category, confidence, source) VALUES (?, ?, ?, ?)');
      stmt.run(trait, 'general', confidence, source);
    }
  }

  /**
   * Category-based upsert: each category (language, tone, trading_style, behavior)
   * has exactly ONE row in user_personas, identified by category.
   * This ensures confidence accumulates correctly across audit cycles
   * instead of creating duplicate rows with slightly different phrasing.
   */
  public upsertPersonaByCategory(
    category: string,
    value: string,
    confidence: number = 0.5,
    source: string = 'nyx_daemon'
  ): void {
    if (!value || !value.trim()) return;
    
    const existing = this.db.prepare(
      'SELECT id, confidence FROM user_personas WHERE category = ?'
    ).get(category) as any;

    try {
      if (existing) {
        const newConfidence = Math.min(1.0, existing.confidence + (confidence * 0.2));
        this.db.prepare(
          'UPDATE user_personas SET trait = ?, confidence = ?, source = ?, lastUpdated = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(value.trim(), newConfidence, source, existing.id);
      } else {
        this.db.prepare(
          'INSERT INTO user_personas (trait, category, confidence, source) VALUES (?, ?, ?, ?)'
        ).run(value.trim(), category, confidence, source);
      }
    } catch (e: any) {
      // Handle UNIQUE constraint collision if the trait already exists in the database (e.g. from an older version with category 'general')
      if (e.message && e.message.includes('UNIQUE constraint failed')) {
        this.db.prepare(
          'UPDATE user_personas SET category = ?, confidence = ?, source = ?, lastUpdated = CURRENT_TIMESTAMP WHERE trait = ?'
        ).run(category, confidence, source, value.trim());
      } else {
        throw e;
      }
    }
  }

  public getPersonas(): any[] {
    const stmt = this.db.prepare('SELECT * FROM user_personas ORDER BY confidence DESC');
    return stmt.all() as any[];
  }

  /**
   * Get personas filtered by minimum confidence threshold.
   */
  public getStrongPersonas(minConfidence: number = 0.5): any[] {
    const stmt = this.db.prepare(
      'SELECT * FROM user_personas WHERE confidence >= ? ORDER BY confidence DESC'
    );
    return stmt.all(minConfidence) as any[];
  }

  public deletePersonaByTrait(keyword: string): number {
    const stmt = this.db.prepare('DELETE FROM user_personas WHERE trait LIKE ?');
    const result = stmt.run(`%${keyword}%`);
    return (result as any).changes || 0;
  }
}

// Singleton instance
export const episodicDB = new EpisodicMemoryDB();
