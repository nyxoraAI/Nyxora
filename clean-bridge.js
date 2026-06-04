const fs = require('fs');
const file = 'packages/core/src/web3/skills/bridgeToken.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Delete lines in reverse order so indices don't shift
lines.splice(204, 54); // Lines 205 to 258
lines.splice(192, 4);  // Lines 193 to 196
lines.splice(59, 93);  // Lines 60 to 152

fs.writeFileSync(file, lines.join('\n'));
console.log('Successfully removed LayerZero from bridgeToken.ts');
