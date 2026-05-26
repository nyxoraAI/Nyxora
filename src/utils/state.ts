let decryptedPrivateKey: string | null = null;
let sessionToken: string | null = null;

import crypto from 'crypto';

export function getSessionToken(): string {
  if (!sessionToken) {
    sessionToken = crypto.randomBytes(32).toString('hex');
  }
  return sessionToken;
}

export function setPrivateKey(key: string) {
  decryptedPrivateKey = key;
}

export function getPrivateKey(): string {
  if (!decryptedPrivateKey) {
    throw new Error('Private key is not loaded into memory. Please authenticate first.');
  }
  return decryptedPrivateKey;
}

export function clearPrivateKey() {
  decryptedPrivateKey = null;
}
