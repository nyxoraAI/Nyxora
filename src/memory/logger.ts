import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { loadConfig } from '../config/parser';
import { getPath } from '../config/paths';

export interface MemoryEntry {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export class Logger {
  private db: Database.Database;

  constructor() {
    const config = loadConfig();
    let dbPath = config.memory?.path || 'memory.db';
    if (dbPath.endsWith('.json')) {
        dbPath = dbPath.replace('.json', '.db');
    }
    const fullPath = getPath(dbPath);
    
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(fullPath);
    this.initDb();
  }

  private initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        name TEXT,
        tool_call_id TEXT,
        tool_calls TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration logic from old memory.json to SQLite
    const config = loadConfig();
    const oldJsonPath = getPath(config.memory?.path || 'memory.json');
    
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
          
          const insertMany = this.db.transaction((entries: any[]) => {
            for (const entry of entries) {
              insert.run({
                role: entry.role,
                content: entry.content || '',
                name: entry.name || null,
                tool_call_id: entry.tool_call_id || null,
                tool_calls: entry.tool_calls ? JSON.stringify(entry.tool_calls) : null
              });
            }
          });
          
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

  public getHistory(): MemoryEntry[] {
    const rows = this.db.prepare('SELECT role, content, name, tool_call_id, tool_calls FROM messages ORDER BY id ASC').all();
    return rows.map((row: any) => {
      const entry: MemoryEntry = {
        role: row.role,
        content: row.content,
      };
      if (row.name) entry.name = row.name;
      if (row.tool_call_id) entry.tool_call_id = row.tool_call_id;
      if (row.tool_calls) entry.tool_calls = JSON.parse(row.tool_calls);
      return entry;
    });
  }

  public addEntry(entry: MemoryEntry) {
    const insert = this.db.prepare(`
      INSERT INTO messages (role, content, name, tool_call_id, tool_calls)
      VALUES (@role, @content, @name, @tool_call_id, @tool_calls)
    `);
    
    insert.run({
      role: entry.role,
      content: entry.content || '',
      name: entry.name || null,
      tool_call_id: entry.tool_call_id || null,
      tool_calls: entry.tool_calls ? JSON.stringify(entry.tool_calls) : null
    });
  }

  public clear() {
    this.db.prepare('DELETE FROM messages').run();
  }
}
