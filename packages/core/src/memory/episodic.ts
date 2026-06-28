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
        confidence REAL DEFAULT 0.1,
        source TEXT,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  public addCandidateFact(fact: string, confidenceScore: number = 0.5, category: string = 'general', ruleType: 'temporary' | 'permanent' | 'observation' = 'observation', keyTopic?: string): void {
    if (keyTopic) {
      this.invalidateTopic(keyTopic);
    }
    
    // Upsert logic
    const existing = this.db.prepare('SELECT id, occurrences, confidence FROM episodic_memories WHERE fact = ?').get(fact) as any;
    
    const safeScore = Math.min(1.0, confidenceScore);
    
    if (existing) {
      // Increment occurrences, boost confidence slightly up to max 1.0
      const newOccurrences = existing.occurrences + 1;
      const newConfidence = Math.min(1.0, existing.confidence + (safeScore * 0.2)); // Dampened boost

      const stmt = this.db.prepare('UPDATE episodic_memories SET occurrences = ?, confidence = ?, rule_type = ?, key_topic = ?, lastSeen = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(newOccurrences, newConfidence, ruleType, keyTopic || null, existing.id);
    } else {
      const stmt = this.db.prepare('INSERT INTO episodic_memories (fact, confidence, category, rule_type, key_topic) VALUES (?, ?, ?, ?, ?)');
      stmt.run(fact, safeScore, category, ruleType, keyTopic || null);
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

  public clearAllMemories(): void {
    const stmt = this.db.prepare('DELETE FROM episodic_memories');
    stmt.run();
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }

  // --- PERSONA MODELING ---
  public updatePersonaTrait(trait: string, confidence: number = 0.5, source: string = 'honcho'): void {
    const existing = this.db.prepare('SELECT id, confidence FROM user_personas WHERE trait = ?').get(trait) as any;
    
    if (existing) {
      const newConfidence = Math.min(1.0, existing.confidence + (confidence * 0.2));
      const stmt = this.db.prepare('UPDATE user_personas SET confidence = ?, source = ?, lastUpdated = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(newConfidence, source, existing.id);
    } else {
      const stmt = this.db.prepare('INSERT INTO user_personas (trait, confidence, source) VALUES (?, ?, ?)');
      stmt.run(trait, confidence, source);
    }
  }

  public getPersonas(): any[] {
    const stmt = this.db.prepare('SELECT * FROM user_personas ORDER BY confidence DESC');
    return stmt.all() as any[];
  }
}

// Singleton instance
export const episodicDB = new EpisodicMemoryDB();
