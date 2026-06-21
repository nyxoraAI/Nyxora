const fs = require('fs');
const path = require('path');

const tsxPath = path.resolve(__dirname, '../src/Settings.tsx');
let content = fs.readFileSync(tsxPath, 'utf8');

content = content.replace(/#bf616a/gi, 'var(--danger)');
content = content.replace(/#ebcb8b/gi, 'var(--accent)');
content = content.replace(/#a3be8c/gi, 'var(--success)');

fs.writeFileSync(tsxPath, content, 'utf8');
console.log("Updated Settings.tsx");

const cssPath = path.resolve(__dirname, '../src/index.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

// Ensure placeholders have opacity: 1 and a slightly darker color if needed, or just opacity: 1
if (!cssContent.includes('opacity: 1') && cssContent.includes('.nord-input::placeholder')) {
  cssContent = cssContent.replace(/\.nord-input::placeholder\s*{([^}]+)}/g, (match, inner) => {
    if (!inner.includes('opacity:')) {
      return `.nord-input::placeholder {${inner}  opacity: 0.8;\n}`;
    }
    return match;
  });
  
  // also for textareas we might need to target textarea specifically or just use .nord-input
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log("Updated index.css placeholder opacity");
}
