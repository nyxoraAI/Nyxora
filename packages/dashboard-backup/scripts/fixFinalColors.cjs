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

const replacements = [
  { regex: /#eceff4/gi, replacement: "var(--text-primary)" },
  { regex: /#d8dee9/gi, replacement: "var(--text-secondary)" },
  { regex: /#3b4252/gi, replacement: "var(--glass-border)" }, // often used for borders
  { regex: /#434c5e/gi, replacement: "var(--glass-border)" }, // often used for borders
  { regex: /#4c566a/gi, replacement: "var(--glass-border)" }, // often used for borders
  { regex: /#81a1c1/gi, replacement: "var(--text-secondary)" }, // used for subtle text
  { regex: /#2e3440/gi, replacement: "var(--bg-secondary)" }, // used for backgrounds
];

files.forEach(f => {
  if (f.includes('index.css') || f.includes('App.css')) return;

  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

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
