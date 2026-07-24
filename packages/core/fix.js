const fs = require('fs');
const path = '/home/perasyudha/Nyxora/packages/core/src/agent/superDiscipline.ts';
let content = fs.readFileSync(path, 'utf8');
// Fix the escaping: the string is between the first ` and the last `
const firstTick = content.indexOf('`');
const lastTick = content.lastIndexOf('`');
const inside = content.substring(firstTick + 1, lastTick);
const escaped = inside.replace(/`/g, '\\`');
const fixed = content.substring(0, firstTick + 1) + escaped + content.substring(lastTick);
fs.writeFileSync(path, fixed);
