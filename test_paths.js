const path = require('path');
const fs = require('fs');

const __dirname1 = path.join(process.cwd(), 'dist/packages/core/src/gateway');
console.log('__dirname:', __dirname1);

let dashboardPath = path.join(__dirname1, '..', '..', '..', 'dashboard', 'dist');
console.log('Dev path:', dashboardPath);

if (!fs.existsSync(dashboardPath)) {
  dashboardPath = path.join(__dirname1, '..', '..', '..', '..', '..', 'packages', 'dashboard', 'dist');
  console.log('Compiled path:', dashboardPath);
}
