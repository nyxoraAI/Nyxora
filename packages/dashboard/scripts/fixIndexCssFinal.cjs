const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/index.css');

let content = fs.readFileSync(cssPath, 'utf8');

// split by lines
let lines = content.split('\n');

for (let i = 40; i < lines.length; i++) {
  let line = lines[i];
  
  line = line.replace(/#eceff4/gi, 'var(--text-primary)');
  line = line.replace(/#d8dee9/gi, 'var(--text-secondary)');
  line = line.replace(/#81a1c1/gi, 'var(--text-secondary)'); // used for secondary text/labels
  line = line.replace(/#2e3440/gi, 'var(--bg-sidebar)');
  line = line.replace(/#434c5e/gi, 'var(--glass-border)');
  line = line.replace(/#4c566a/gi, 'var(--tool-bg)'); // or glass-border, but tool-bg works for inputs
  line = line.replace(/#3b4252/gi, 'var(--bg-secondary)');
  
  // also fix rgba hardcoded strings for inputs
  line = line.replace(/rgba\(46,\s*52,\s*64,\s*0\.7\)/g, 'var(--glass-bg)');
  line = line.replace(/rgba\(216,\s*222,\s*233,\s*0\.1\)/g, 'var(--glass-border)');
  line = line.replace(/rgba\(216,\s*222,\s*233,\s*0\.05\)/g, 'var(--glass-border)');
  line = line.replace(/rgba\(136,\s*192,\s*208,\s*0\.2\)/g, 'var(--accent)');
  
  lines[i] = line;
}

fs.writeFileSync(cssPath, lines.join('\n'), 'utf8');
console.log("Updated index.css thoroughly");
