import fs from 'fs';
import path from 'path';
import os from 'os';

let sessionToken: string | null = null;
import crypto from 'crypto';

export function getSessionToken(): string {
  if (!sessionToken) {
    const tokenFile = path.join(os.homedir(), '.nyxora', 'auth.token');
    try {
      if (fs.existsSync(tokenFile)) {
        sessionToken = fs.readFileSync(tokenFile, 'utf8').trim();
      } else {
        sessionToken = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(tokenFile, sessionToken, { mode: 0o600 });
      }
    } catch(e) {
      if (!sessionToken) sessionToken = crypto.randomBytes(32).toString('hex');
    }
  }
  return sessionToken;
}
