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
  // Button backgrounds and icons using hardcoded accent
  { regex: /'#88[cC]0[dD]0'/g, replacement: "'var(--accent)'" },
  { regex: /"#88[cC]0[dD]0"/g, replacement: '"var(--accent)"' },
  // some places might have color: 'white' or color: '#fff' in inline styles
  { regex: /color:\s*'white'/g, replacement: "color: 'var(--text-primary)'" },
  { regex: /color:\s*"white"/g, replacement: 'color: "var(--text-primary)"' },
  { regex: /color:\s*'#fff'/gi, replacement: "color: 'var(--text-primary)'" },
  { regex: /color:\s*"#fff"/gi, replacement: 'color: "var(--text-primary)"' },
  { regex: /color:\s*'#ffffff'/gi, replacement: "color: 'var(--text-primary)'" },
  { regex: /color:\s*"#ffffff"/gi, replacement: 'color: "var(--text-primary)"' }
];

const cssReplacements = [
  { regex: /color: white;/g, replacement: "color: var(--text-primary);" },
  { regex: /color: #fff;/gi, replacement: "color: var(--text-primary);" },
  { regex: /color: #ffffff;/gi, replacement: "color: var(--text-primary);" },
  { regex: /background: #88c0d0;/gi, replacement: "background: var(--accent);" },
  { regex: /color: #88c0d0;/gi, replacement: "color: var(--accent);" },
  { regex: /border-color: #88c0d0;/gi, replacement: "border-color: var(--accent);" },
  { regex: /border: 2px solid #88c0d0;/gi, replacement: "border: 2px solid var(--accent);" },
  { regex: /background-color: #88c0d0;/gi, replacement: "background-color: var(--accent);" },
];

files.forEach(f => {
  if (f.includes('index.css') || f.includes('App.css')) {
    // only do css replacements on these but BE CAREFUL not to replace the root definitions
    // wait, we shouldn't touch the :root definition or body.light-theme definitions!
    // actually, it's safer to only modify the rules OUTSIDE of :root. Let's do it simply by not touching index.css and do index.css manually instead to avoid breaking the variables!
    return;
  }

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
