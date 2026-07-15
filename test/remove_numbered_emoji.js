const fs = require('fs');
const path = require('path');

const docsDir = path.join(process.cwd(), 'docs');

// Regex to match a heading with an emoji that is immediately followed by a number (e.g. "1. ")
// Capture group 1: The hashes (e.g., "###")
// Capture group 2: The emoji (which we want to remove)
// Capture group 3: The actual text starting with the number (e.g., "1. Transaction Request")
const numberedEmojiRegex = /^(#{1,6})\s+(?:[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🚀✨]+)\s+(\d+\..*)$/u;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(numberedEmojiRegex);
    if (match) {
      lines[i] = `${match[1]} ${match[2]}`;
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Removed numbered emoji from ${filePath}`);
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
console.log('Finished removing emojis from numbered headings!');
