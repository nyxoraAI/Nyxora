const str = `Oke, gue cekin wallet lo di chain Robinhood sekarang. Tunggu bentar ya... \`\`\`json
[
  {
    "tool_name": "check_portfolio",
    "tool_params": {
      "wallet_address": "0xE5c21F46993C67CFe04FCF1579486D390Be7B535",
      "chain": "robinhood"
    }
  }
]
\`\`\`
`;
const cleanText = str.replace(/\[[\s\S]*?"tool_name"[\s\S]*?\]/g, '');
console.log("Original:");
console.log(str);
console.log("Cleaned:");
console.log(cleanText);
