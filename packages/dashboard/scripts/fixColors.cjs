const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');

function walk(d) {
  let results = [];
  const list = fs.readdirSync(d);
  list.forEach(file => {
    file = path.join(d, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.css')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);

const tsxReplacements = [
  { regex: /'#2[eE]3440'/g, replacement: "'var(--bg-secondary)'" },
  { regex: /"#2[eE]3440"/g, replacement: '"var(--bg-secondary)"' },
  { regex: /'#3[bB]4252'/g, replacement: "'var(--bg-sidebar)'" },
  { regex: /"#3[bB]4252"/g, replacement: '"var(--bg-sidebar)"' },
  { regex: /'#434[cC]5[eE]'/g, replacement: "'var(--glass-border)'" },
  { regex: /"#434[cC]5[eE]"/g, replacement: '"var(--glass-border)"' },
  { regex: /'#4[cC]566[aA]'/g, replacement: "'var(--tool-bg)'" },
  { regex: /"#4[cC]566[aA]"/g, replacement: '"var(--tool-bg)"' },
];

const cssReplacements = [
  { regex: /color: #fff;/g, replacement: "color: var(--text-primary);" },
  { regex: /background: rgba\(20, 24, 32, 0\.6\);/g, replacement: "background: var(--bg-secondary);" },
  { regex: /background: rgba\(10, 12, 16, 0\.8\);/g, replacement: "background: var(--bg-sidebar);" },
  { regex: /background: rgba\(0, 0, 0, 0\.3\);/g, replacement: "background: var(--bg-color);" },
  { regex: /background: rgba\(255, 255, 255, 0\.05\);/g, replacement: "background: var(--glass-border);" },
  { regex: /border: 1px solid rgba\(255, 255, 255, 0\.05\);/g, replacement: "border: 1px solid var(--glass-border);" },
  { regex: /border-bottom: 1px solid rgba\(255, 255, 255, 0\.05\);/g, replacement: "border-bottom: 1px solid var(--glass-border);" },
  { regex: /border: 1px solid rgba\(255, 255, 255, 0\.1\);/g, replacement: "border: 1px solid var(--glass-border);" },
  { regex: /color: white;/g, replacement: "color: var(--text-primary);" },
];

files.forEach(f => {
  if (f.includes('index.css') || f.includes('App.css')) return; // skip main css where vars are defined

  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  const replacements = f.endsWith('.css') ? cssReplacements : tsxReplacements;

  replacements.forEach(({ regex, replacement }) => {
    if (content.match(regex)) {
      content = content.replace(regex, replacement);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(f, content, 'utf8');
    console.log("Updated", f);
  }
});
