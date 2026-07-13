const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const os = require('os');

const dbPath = os.homedir() + '/.nyxora/data/memory.db';
const db = new DatabaseSync(dbPath);

const rows = db.prepare("SELECT content FROM messages WHERE content LIKE '%rubah logo nyxora jadi itu%' ORDER BY id DESC LIMIT 1").all();

if (rows.length === 0) {
  console.log('No matching message found in memory.db');
  process.exit(1);
}

const content = rows[0].content;
const match = content.match(/<svg[\s\S]*?<\/svg>/);

if (!match) {
  console.log('No SVG found in the message');
  process.exit(1);
}

let svgContent = match[0];

// Convert SVG to React Component
let reactComponent = `import React from 'react';

const NyxoraLogo = ({ size = 28, className = "" }) => {
  return (
    ${svgContent.replace(/enable-background="[^"]*"/g, '').replace(/xml:space="preserve"/g, '').replace(/version="1.1"/g, 'version="1.1"').replace(/xmlns:xlink="[^"]*"/g, '').replace(/x="0px" y="0px"/g, '')}
  );
};

export default NyxoraLogo;
`;

reactComponent = reactComponent.replace(/width="100%"/, 'width={size} height={size} className={className}');
reactComponent = reactComponent.replace(/viewBox="0 0 1254 1254"/, 'viewBox="0 0 1254 1254"');

fs.writeFileSync('/home/perasyudha/Downloads/Nyxora-main/packages/dashboard/src/NyxoraLogo.tsx', reactComponent);
console.log('Extracted full SVG from memory.db and updated NyxoraLogo.tsx successfully!');
