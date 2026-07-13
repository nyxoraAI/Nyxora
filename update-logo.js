const fs = require('fs');
const svg = fs.readFileSync('/home/perasyudha/Downloads/new logo/file.svg', 'utf8');

// Extract all path elements
const pathMatches = svg.match(/<path[\s\S]*?\/>|<path[\s\S]*?<\/path>/g);
const paths = pathMatches ? pathMatches.join('\n') : '';

if (!paths) {
  console.log("Error: No paths found in SVG");
  process.exit(1);
}

const reactCode = `import React from 'react';

const NyxoraLogo = ({ size = 28, className = "", color = "var(--accent)" }) => {
  return (
    <svg 
      version="1.1" 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 1254 1254"
      width={size}
      height={size}
      className={className}
    >
      ${paths}
    </svg>
  );
};

export default NyxoraLogo;
`;

fs.writeFileSync('/home/perasyudha/Downloads/Nyxora-main/packages/dashboard/src/NyxoraLogo.tsx', reactCode);
console.log("Logo updated successfully!");
