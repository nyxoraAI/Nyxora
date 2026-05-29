"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const parser_1 = require("../config/parser");
const paths_1 = require("../config/paths");
class Logger {
    db;
    constructor() {
        const config = (0, parser_1.loadConfig)() || {};
        let dbPath = (config && config.memory && config.memory.path) ? config.memory.path : 'memory.db';
        if (dbPath.endsWith('.json')) {
            dbPath = dbPath.replace('.json', '.db');
        }
        const fullPath = (0, paths_1.getPath)(dbPath);
        // Ensure directory exists
        const dir = path_1.default.dirname(fullPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        this.db = new better_sqlite3_1.default(fullPath);
        this.initDb();
    }
    initDb() {
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
        const config = (0, parser_1.loadConfig)() || {};
        const oldJsonPath = (0, paths_1.getPath)((config && config.memory && config.memory.path) ? config.memory.path : 'memory.json');
        const countRow = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();
        if (countRow.count === 0 && fs_1.default.existsSync(oldJsonPath)) {
            try {
                const data = fs_1.default.readFileSync(oldJsonPath, 'utf-8');
                const oldMemory = JSON.parse(data);
                if (Array.isArray(oldMemory) && oldMemory.length > 0) {
                    const insert = this.db.prepare(`
            INSERT INTO messages (role, content, name, tool_call_id, tool_calls)
            VALUES (@role, @content, @name, @tool_call_id, @tool_calls)
          `);
                    const insertMany = this.db.transaction((entries) => {
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
                    fs_1.default.renameSync(oldJsonPath, oldJsonPath + '.bak');
                }
            }
            catch (error) {
                console.error('[Nyxora Memory] Failed to migrate old memory.json:', error);
            }
        }
    }
    getHistory() {
        const rows = this.db.prepare('SELECT role, content, name, tool_call_id, tool_calls FROM messages ORDER BY id ASC').all();
        return rows.map((row) => {
            const entry = {
                role: row.role,
                content: row.content,
            };
            if (row.name)
                entry.name = row.name;
            if (row.tool_call_id)
                entry.tool_call_id = row.tool_call_id;
            if (row.tool_calls)
                entry.tool_calls = JSON.parse(row.tool_calls);
            return entry;
        });
    }
    addEntry(entry) {
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
    clear() {
        this.db.prepare('DELETE FROM messages').run();
    }
}
exports.Logger = Logger;
