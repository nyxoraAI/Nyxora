const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/perasyudha/.nyxora/data/memory.db');
const rows = db.prepare("SELECT role, content, tool_calls FROM messages ORDER BY timestamp DESC LIMIT 10").all();
console.log(JSON.stringify(rows, null, 2));
