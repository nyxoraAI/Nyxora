import { getPath } from './packages/core/src/config/paths';
import fs from 'fs';
const policyPath = getPath('policy.yaml');
console.log('Policy path:', policyPath);
console.log('Exists:', fs.existsSync(policyPath));
try {
  const yaml = require('yaml');
  const file = fs.readFileSync(policyPath, 'utf8');
  console.log('Parsed:', yaml.parse(file));
} catch (e) {
  console.error('Error:', e);
}
