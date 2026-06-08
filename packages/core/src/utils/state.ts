import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPath } from '../config/paths';

let sessionToken: string | null = null;

export function getSessionToken(): string {
  if (!sessionToken) {
    const tokenFile = getPath('auth.token');
    try {
      if (fs.existsSync(tokenFile)) {
        const raw = fs.readFileSync(tokenFile, 'utf8').trim();
        // Support migrating from the temporary JSON format back to raw string
        if (raw.startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            sessionToken = parsed.token;
            // Overwrite file to restore clean string format
            fs.writeFileSync(tokenFile, sessionToken as string, { mode: 0o600 });
          } catch (e) {
            sessionToken = raw;
          }
        } else {
          sessionToken = raw;
        }
      } else {
        sessionToken = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(tokenFile, sessionToken, { mode: 0o600 });
      }
    } catch (e) {
      sessionToken = crypto.randomBytes(32).toString('hex');
    }
  }
  return sessionToken;
}

export function validateToken(incomingToken: string): { valid: boolean } {
  return { valid: incomingToken === getSessionToken() };
}
