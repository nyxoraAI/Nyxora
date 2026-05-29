let sessionToken: string | null = null;

import crypto from 'crypto';

export function getSessionToken(): string {
  if (!sessionToken) {
    sessionToken = crypto.randomBytes(32).toString('hex');
  }
  return sessionToken;
}
