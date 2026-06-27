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

export interface UserProfile {
  id: string;
  risk_level: string;
  max_slippage: number;
  avoid_memecoins: boolean;
  custom_rules: string | null;
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

    // V3: Limit Orders & Event-Driven Engine
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS limit_orders (
        id TEXT PRIMARY KEY,
        token_address TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        trigger_condition TEXT NOT NULL,
        trigger_price_usd REAL NOT NULL,
        action TEXT NOT NULL,
        amount_usd REAL NOT NULL,
        slippage_tolerance REAL DEFAULT 5.0,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        tx_hash TEXT
      )
    `);

    // V3: Personalized Risk Profile
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        risk_level TEXT DEFAULT 'Moderate',
        max_slippage REAL DEFAULT 1.0,
        avoid_memecoins BOOLEAN DEFAULT 0,
        custom_rules TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);


    // Ensure session_id exists for older DBs
    try {
      this.db.prepare('ALTER TABLE messages ADD COLUMN session_id TEXT').run();
    } catch {}

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
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId);
    const stmt2 = this.db.prepare('DELETE FROM messages WHERE session_id = ?');
    stmt2.run(sessionId);
  }

  public renameSession(sessionId: string, newTitle: string) {
    this.db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(newTitle, sessionId);
  }

  public searchSessions(query: string) {
    const term = `%${query}%`;
    return this.db.prepare(`
      SELECT DISTINCT s.* 
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
      WHERE s.title LIKE ? OR m.content LIKE ?
      ORDER BY s.timestamp DESC
    `).all(term, term);
  }

  public getHistory(sessionId?: string, limit: number = 40): MemoryEntry[] {
    let rows;
    // Phase 2: Sliding Window Algorithm (LLM Context Limit)
    // Fetch only the last X messages, then order them chronologically
    if (sessionId) {
      rows = this.db.prepare(`
        SELECT * FROM (
          SELECT role, content, name, tool_call_id, tool_calls, session_id, id 
          FROM messages 
          WHERE session_id = ? 
          ORDER BY id DESC LIMIT ?
        ) ORDER BY id ASC
      `).all(sessionId, limit);
    } else {
      rows = this.db.prepare(`
        SELECT * FROM (
          SELECT role, content, name, tool_call_id, tool_calls, session_id, id 
          FROM messages 
          WHERE session_id IS NULL
          ORDER BY id DESC LIMIT ?
        ) ORDER BY id ASC
      `).all(limit);
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
    if (sessionId) {
      // Auto-create session if it doesn't exist (e.g. for Telegram integration)
      try {
        const sessionExists = this.db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(sessionId);
        if (!sessionExists) {
          const title = sessionId.startsWith('telegram_') ? `Telegram Chat` : 'New Session';
          this.db.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run(sessionId, title);
        }
      } catch {}
    }

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

  public close() {
    try {
      this.db.close();
      console.log('[Nyxora Memory] SQLite database closed gracefully.');
    } catch (e) {
      console.error('[Nyxora Memory] Error closing database:', e);
    }
  }

  // V3: User Persona & Risk Profile
  public getUserProfile(): UserProfile | null {
    try {
      const row = this.db.prepare('SELECT * FROM user_profiles WHERE id = ?').get('default') as any;
      if (row) {
        return {
          id: row.id,
          risk_level: row.risk_level,
          max_slippage: row.max_slippage,
          avoid_memecoins: Boolean(row.avoid_memecoins),
          custom_rules: row.custom_rules
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  public updateUserProfile(profile: Partial<UserProfile>) {
    const existing = this.getUserProfile() || {
      id: 'default',
      risk_level: 'Moderate',
      max_slippage: 1.0,
      avoid_memecoins: false,
      custom_rules: null
    };
    
    const updated = { ...existing, ...profile };
    
    this.db.prepare(`
      INSERT INTO user_profiles (id, risk_level, max_slippage, avoid_memecoins, custom_rules, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        risk_level = excluded.risk_level,
        max_slippage = excluded.max_slippage,
        avoid_memecoins = excluded.avoid_memecoins,
        custom_rules = excluded.custom_rules,
        updated_at = excluded.updated_at
    `).run(
      'default',
      updated.risk_level,
      updated.max_slippage,
      updated.avoid_memecoins ? 1 : 0,
      updated.custom_rules
    );
  }

  // V3: Limit Orders
  public createLimitOrder(order: any): string {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO limit_orders (
        id, token_address, token_symbol, trigger_condition, trigger_price_usd, action, amount_usd, slippage_tolerance, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      order.token_address,
      order.token_symbol,
      order.trigger_condition,
      order.trigger_price_usd,
      order.action,
      order.amount_usd,
      order.slippage_tolerance || 5.0,
      'PENDING_APPROVAL' // Requires user approval in Dashboard/Telegram
    );
    return id;
  }

  public activateLimitOrder(orderId: string): boolean {
    const result = this.db.prepare(`UPDATE limit_orders SET status = 'ACTIVE' WHERE id = ?`).run(orderId);
    return result.changes > 0;
  }
}

export const logger = new Logger();
