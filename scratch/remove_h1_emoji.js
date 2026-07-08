const fs = require('fs');
const path = require('path');

const docsDir = path.join(process.cwd(), 'docs');

// Regex to match an H1 heading that starts with an emoji.
// It looks for '# ', followed by an emoji, followed by an optional space, then the text.
const h1EmojiRegex = /^#\s+([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🚀✨]+)\s+(.*)$/u;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(h1EmojiRegex);
    if (match) {
      // match[1] is the emoji, match[2] is the actual heading text
      lines[i] = `# ${match[2]}`;
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Removed H1 emoji from ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!file.startsWith('.')) walkDir(fullPath);
    } else if (file.endsWith('.md')) {
      processFile(fullPath);
    }
  }
}

walkDir(docsDir);
console.log('Finished removing H1 emojis!');
