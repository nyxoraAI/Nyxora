const Database = require('better-sqlite3');
const db = new Database('/home/perasyudha/.nyxora/data/memory.db');

const rows = db.prepare("SELECT role, tool_calls FROM messages WHERE tool_calls IS NOT NULL ORDER BY timestamp DESC LIMIT 20").all();
rows.forEach(r => console.log(r.tool_calls));
