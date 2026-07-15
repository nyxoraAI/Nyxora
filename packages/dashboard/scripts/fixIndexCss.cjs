const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/index.css');

let content = fs.readFileSync(cssPath, 'utf8');

// split by lines
let lines = content.split('\n');

for (let i = 40; i < lines.length; i++) {
  let line = lines[i];
  
  line = line.replace(/color:\s*white;/g, 'color: var(--text-primary);');
  line = line.replace(/color:\s*#fff;/g, 'color: var(--text-primary);');
  line = line.replace(/color:\s*#ffffff;/g, 'color: var(--text-primary);');
  
  line = line.replace(/background(-color)?:\s*#88c0d0;/gi, 'background-color: var(--accent);');
  line = line.replace(/background:\s*#88c0d0;/gi, 'background: var(--accent);');
  line = line.replace(/color:\s*#88c0d0;/gi, 'color: var(--accent);');
  line = line.replace(/border-color:\s*#88c0d0;/gi, 'border-color: var(--accent);');
  line = line.replace(/border:\s*2px solid #88c0d0;/gi, 'border: 2px solid var(--accent);');
  
  lines[i] = line;
}

fs.writeFileSync(cssPath, lines.join('\n'), 'utf8');
console.log("Updated index.css");
