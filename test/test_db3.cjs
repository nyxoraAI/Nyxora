const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/perasyudha/.nyxora/data/memory.db');
const rows = db.prepare("SELECT id, role, content, name, tool_calls, tool_call_id FROM messages ORDER BY timestamp DESC LIMIT 5").all();
console.log(JSON.stringify(rows, null, 2));
