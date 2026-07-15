const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/perasyudha/.nyxora/data/memory.db');
const row = db.prepare("SELECT tool_calls FROM messages WHERE tool_calls IS NOT NULL AND tool_calls != '' ORDER BY timestamp DESC LIMIT 1").get();
console.log("DB RAW:", row.tool_calls);
