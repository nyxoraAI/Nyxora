import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { getAppDir } from '../config/paths';

export interface EpisodicMemory {
  id: number;
  fact: string;
  occurrences: number;
  confidence: number;
  category: string;
  rule_type: 'temporary' | 'permanent' | 'observation';
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
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  public addCandidateFact(fact: string, confidenceScore: number = 0.5, category: string = 'general', ruleType: 'temporary' | 'permanent' | 'observation' = 'observation'): void {
    // Upsert logic
    const existing = this.db.prepare('SELECT id, occurrences, confidence FROM episodic_memories WHERE fact = ?').get(fact) as any;
    
    if (existing) {
      // Increment occurrences, boost confidence slightly up to max 1.0
      const newOccurrences = existing.occurrences + 1;
      const newConfidence = Math.min(1.0, existing.confidence + (confidenceScore * 0.2)); // Dampened boost

      const stmt = this.db.prepare('UPDATE episodic_memories SET occurrences = ?, confidence = ?, rule_type = ?, lastSeen = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(newOccurrences, newConfidence, ruleType, existing.id);
    } else {
      const stmt = this.db.prepare('INSERT INTO episodic_memories (fact, confidence, category, rule_type) VALUES (?, ?, ?, ?)');
      stmt.run(fact, confidenceScore, category, ruleType);
    }
  }

  public getMemories(): EpisodicMemory[] {
    const stmt = this.db.prepare('SELECT * FROM episodic_memories ORDER BY confidence DESC, lastSeen DESC');
    return stmt.all() as unknown as EpisodicMemory[];
  }

  public deleteMemory(id: number): void {
    const stmt = this.db.prepare('DELETE FROM episodic_memories WHERE id = ?');
    stmt.run(id);
  }

  public decayMemories(daysOld: number = 60, minConfidence: number = 0.3): void {
    // Delete memories older than X days that never reached the minimum confidence
    const stmt = this.db.prepare(`
      DELETE FROM episodic_memories 
      WHERE confidence < ? AND lastSeen <= datetime('now', '-' || ? || ' days')
    `);
    stmt.run(minConfidence, daysOld);
  }

  public close(): void {
    try {
      this.db.close();
    } catch (e) {
      // ignore
    }
  }
}

// Singleton instance
export const episodicDB = new EpisodicMemoryDB();
