const fs = require('fs');
const path = require('path');

const mmdCode = fs.readFileSync('architecture.mmd', 'utf8');

// Some services support raw base64, some require specific formatting.
// mermaid.ink supports raw base64 encoded strings
const b64 = Buffer.from(mmdCode).toString('base64');
const url = `https://mermaid.ink/svg/${b64}`;

console.log(`Fetching from: ${url}`);

fetch(url)
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  })
  .then(svg => {
    const assetsDir = path.join(process.cwd(), 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
    fs.writeFileSync(path.join(assetsDir, 'architecture.svg'), svg);
    console.log('Successfully saved architecture.svg');
  })
  .catch(err => {
    console.error('Failed to fetch SVG:', err);
  });
