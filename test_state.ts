import { validateToken, getSessionToken } from './packages/core/src/utils/state';
import fs from 'fs';
import { getPath } from './packages/core/src/config/paths';

const tokenFile = getPath('auth.token');

// Force file to be old
let state = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
state.createdAt = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
fs.writeFileSync(tokenFile, JSON.stringify(state));

console.log('1. Initial token from disk:', state.token);

const validation = validateToken(state.token);

console.log('2. Validation result:', validation);

const newState = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
console.log('3. New token on disk:', newState.token);
console.log('4. Previous token saved:', newState.previousToken === state.token);
