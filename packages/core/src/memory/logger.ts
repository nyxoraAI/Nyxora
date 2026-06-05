import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from '../config/parser';
import { getPath } from '../config/paths';

export interface MemoryEntry {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
  session_id?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

export class Logger {
  private db: DatabaseSync;

  constructor() {
    const config = loadConfig() || {};
    let dbPath = (config && (config as any).memory && (config as any).memory.path) ? (config as any).memory.path : 'memory.db';
    if (dbPath.endsWith('.json')) {
        dbPath = dbPath.replace('.json', '.db');
    }
    const fullPath = getPath(dbPath);
    
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(fullPath);
    this.initDb();
  }

  private initDb() {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        name TEXT,
        tool_call_id TEXT,
        tool_calls TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Phase 1: SQLite Index Optimization
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_id ON messages(session_id);
    `);

    // Ensure session_id exists for older DBs
    try {
      this.db.prepare('ALTER TABLE messages ADD COLUMN session_id TEXT').run();
    } catch (e) {
      // Column probably already exists
    }

    // Migration logic from old memory.json to SQLite
    const config = loadConfig() || {};
    const oldJsonPath = getPath((config && (config as any).memory && (config as any).memory.path) ? (config as any).memory.path : 'memory.json');
    
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
    
    if (countRow.count === 0 && fs.existsSync(oldJsonPath)) {
      try {
        const data = fs.readFileSync(oldJsonPath, 'utf-8');
        const oldMemory = JSON.parse(data);
        if (Array.isArray(oldMemory) && oldMemory.length > 0) {
          const insert = this.db.prepare(`
            INSERT INTO messages (role, content, name, tool_call_id, tool_calls)
            VALUES (@role, @content, @name, @tool_call_id, @tool_calls)
          `);
          
          const insertMany = (entries: any[]) => {
            this.db.exec('BEGIN TRANSACTION');
            try {
              for (const entry of entries) {
                insert.run({
                  role: entry.role,
                  content: entry.content || '',
                  name: entry.name || null,
                  tool_call_id: entry.tool_call_id || null,
                  tool_calls: entry.tool_calls ? JSON.stringify(entry.tool_calls) : null
                });
              }
              this.db.exec('COMMIT');
            } catch (e) {
              this.db.exec('ROLLBACK');
              throw e;
            }
          };
          
          insertMany(oldMemory);
          console.log('[Nyxora Memory] Successfully migrated memory.json to SQLite database (Atomic Storage).');
          
          // Rename old file to prevent re-migration issues and keep as backup
          fs.renameSync(oldJsonPath, oldJsonPath + '.bak');
        }
      } catch (error) {
        console.error('[Nyxora Memory] Failed to migrate old memory.json:', error);
      }
    }
  }

  public getSessions(): ChatSession[] {
    const rows = this.db.prepare('SELECT id, title, timestamp FROM sessions ORDER BY timestamp DESC').all();
    return rows as unknown as ChatSession[];
  }

  public createSession(title: string): string {
    const id = crypto.randomUUID();
    this.db.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run(id, title);
    return id;
  }

  public deleteSession(sessionId: string) {
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  public renameSession(sessionId: string, newTitle: string) {
    this.db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(newTitle, sessionId);
  }

  public getHistory(sessionId?: string): MemoryEntry[] {
    let rows;
    // Phase 2: Sliding Window Algorithm (LLM Context Limit)
    // Fetch only the last 40 messages, then order them chronologically
    if (sessionId) {
      rows = this.db.prepare(`
        SELECT * FROM (
          SELECT role, content, name, tool_call_id, tool_calls, session_id, id 
          FROM messages 
          WHERE session_id = ? 
          ORDER BY id DESC LIMIT 40
        ) ORDER BY id ASC
      `).all(sessionId);
    } else {
      rows = this.db.prepare(`
        SELECT * FROM (
          SELECT role, content, name, tool_call_id, tool_calls, session_id, id 
          FROM messages 
          WHERE session_id IS NULL 
          ORDER BY id DESC LIMIT 40
        ) ORDER BY id ASC
      `).all();
    }
    
    return rows.map((row: any) => {
      const entry: MemoryEntry = {
        role: row.role,
        content: row.content,
      };
      if (row.name) entry.name = row.name;
      if (row.tool_call_id) entry.tool_call_id = row.tool_call_id;
      if (row.tool_calls) entry.tool_calls = JSON.parse(row.tool_calls);
      if (row.session_id) entry.session_id = row.session_id;
      return entry;
    });
  }

  public addEntry(entry: MemoryEntry, sessionId?: string) {
    const insert = this.db.prepare(`
      INSERT INTO messages (session_id, role, content, name, tool_call_id, tool_calls)
      VALUES (@session_id, @role, @content, @name, @tool_call_id, @tool_calls)
    `);
    
    insert.run({
      session_id: sessionId || null,
      role: entry.role,
      content: entry.content || '',
      name: entry.name || null,
      tool_call_id: entry.tool_call_id || null,
      tool_calls: entry.tool_calls ? JSON.stringify(entry.tool_calls) : null
    });
  }

  public clear(sessionId?: string) {
    if (sessionId) {
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    } else {
      this.db.prepare('DELETE FROM messages WHERE session_id IS NULL').run();
    }
  }
}
