const Database = require('better-sqlite3');
const db = new Database('/home/perasyudha/Nyxora/memory.db');

const msgs = db.prepare('SELECT role, content, tool_calls, tool_call_id FROM messages ORDER BY created_at DESC LIMIT 10').all();
console.log(JSON.stringify(msgs, null, 2));
