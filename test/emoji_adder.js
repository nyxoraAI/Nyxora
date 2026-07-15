const fs = require('fs');
const path = require('path');

const docsDir = path.join(process.cwd(), 'docs');

const emojiMap = {
  // Common terms mapped to emojis
  'architecture': '🏗️',
  'bridge': '🌉',
  'routing': '🔀',
  'chain': '⛓️',
  'network': '🌐',
  'contributing': '🤝',
  'dashboard': '🖥️',
  'ui': '✨',
  'defi': '🏦',
  'config': '⚙️',
  'ecosystem': '🌱',
  'etherscan': '🔍',
  'google': '☁️',
  'workspace': '🏢',
  'guarded': '🛡️',
  'autonomy': '🤖',
  'market': '📈',
  'intelligence': '🧠',
  'oracle': '🔮',
  'memory': '💾',
  'nlp': '🗣️',
  'privacy': '🔒',
  'roadmap': '🛣️',
  'rpc': '🔌',
  'sandbox': '🪣',
  'slippage': '📉',
  'smart contract': '📜',
  'structure': '🏗️',
  'term': '⚖️',
  'troubleshooting': '🔧',
  'vault': '🏦',
  'wallet': '👛',
  'search': '🔎',
  'api': '🔌',
  'guide': '📖',
  'overview': '👀',
  'setup': '⚙️',
  'introduction': '👋',
  'feature': '✨',
  'security': '🛡️'
};

const defaultEmojis = ['🔹', '🔸', '✨', '🚀', '💡', '📌', '⚡'];

function getEmojiForText(text) {
  const lower = text.toLowerCase();
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(key)) {
      return emoji;
    }
  }
  return defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Match headings that don't already start with an emoji (excluding typical punctuation)
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,3})\s+(.*)$/);
    if (match) {
      const level = match[1];
      const text = match[2];
      
      // Check if text already starts with an emoji or HTML tag
      if (!/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🚀✨]/u.test(text) && !text.startsWith('<')) {
        const emoji = getEmojiForText(text);
        lines[i] = `${level} ${emoji} ${text}`;
        changed = true;
      }
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Updated ${filePath}`);
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
console.log('Finished adding emojis!');
