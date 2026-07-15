import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Secure key for signing file download tokens
// We will use the INTERNAL_AUTH_TOKEN from environment if available,
// otherwise generate a random one per session.
let FILE_SECRET = process.env.INTERNAL_AUTH_TOKEN;

if (!FILE_SECRET) {
  try {
    const nyxoraDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora');
    const tokenPath = path.join(nyxoraDir, 'auth', 'runtime.token');
    if (fs.existsSync(tokenPath)) {
      FILE_SECRET = fs.readFileSync(tokenPath, 'utf8').trim();
    } else {
      FILE_SECRET = crypto.randomBytes(32).toString('hex');
    }
  } catch (e) {
    FILE_SECRET = crypto.randomBytes(32).toString('hex');
  }
}

export function generateFileToken(absolutePath: string, expiresInMinutes: number = 15): string {
  if (!FILE_SECRET) throw new Error('Cannot generate token without secret.');
  return jwt.sign({ filepath: absolutePath }, FILE_SECRET, { expiresIn: `${expiresInMinutes}m` });
}

export function verifyFileToken(token: string): string | null {
  try {
    if (!FILE_SECRET) return null;
    const decoded = jwt.verify(token, FILE_SECRET) as { filepath: string };
    return decoded.filepath;
  } catch (error) {
    return null;
  }
}

export function getPublicUrl(): string {
  try {
    const urlPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora', 'public_url.txt');
    if (fs.existsSync(urlPath)) {
      return fs.readFileSync(urlPath, 'utf8').trim();
    }
  } catch (e) {}
  return 'http://localhost:3000';
}
