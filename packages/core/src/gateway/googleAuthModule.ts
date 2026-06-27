import fs from 'fs';
import path from 'path';
import { getPath } from '../config/paths';

const CREDENTIALS_PATH = getPath('google-credentials.json');
const FALLBACK_TOKEN_PATH = getPath('google-tokens.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/drive.file'
];

interface GoogleCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

let credentials: GoogleCredentials | null = null;
let accessToken: string | null = null;
let tokenExpiry: number = 0; // Unix timestamp in ms

export async function initGoogleAuth(): Promise<boolean> {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log(`[Google Auth] No credentials found at ${CREDENTIALS_PATH}`);
    return false;
  }

  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    const parsed = JSON.parse(content);
    credentials = parsed.web || parsed.installed;

    // Check if we already have a refresh token saved
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // console.log('[Google Auth] Refresh token found in secure storage.'); // Suppressed to avoid CLI prompt disruption
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Google Auth] Error initializing:', err);
    return false;
  }
}

export function getAuthUrl(): string | null {
  if (!credentials) return null;

  const params = new URLSearchParams({
    client_id: credentials.client_id,
    redirect_uri: credentials.redirect_uris[0],
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function processCallback(code: string): Promise<boolean> {
  if (!credentials) return false;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        redirect_uri: credentials.redirect_uris[0],
        grant_type: 'authorization_code'
      }).toString()
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Google Auth] Token exchange failed:', data);
      return false;
    }

    if (data.access_token) {
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000);
    }

    if (data.refresh_token) {
      await saveRefreshToken(data.refresh_token);
    }

    return true;
  } catch (err) {
    console.error('[Google Auth] Error processing callback:', err);
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const rt = await getRefreshToken();
  return !!rt;
}

export async function getAccessToken(): Promise<string | null> {
  if (!credentials) return null;

  // If token is valid for at least 5 more minutes, use it
  if (accessToken && Date.now() < tokenExpiry - 300000) {
    return accessToken;
  }

  // Otherwise, refresh it
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        grant_type: 'refresh_token'
      }).toString()
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Google Auth] Failed to refresh token:', data);
      return null;
    }

    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    return accessToken;
  } catch (err) {
    console.error('[Google Auth] Error refreshing token:', err);
    return null;
  }
}

export async function logoutGoogle(): Promise<boolean> {
  try {
    const { Entry } = require('@napi-rs/keyring');
    const entry = new Entry('nyxora', 'google_refresh_token');
    await entry.deletePassword();
  } catch {}

  try {
    if (fs.existsSync(FALLBACK_TOKEN_PATH)) {
      fs.unlinkSync(FALLBACK_TOKEN_PATH);
    }
  } catch {}

  accessToken = null;
  tokenExpiry = 0;
  console.log('[Google Auth] Successfully logged out.');
  return true;
}

// ---- Secure Storage for Refresh Token ----

async function saveRefreshToken(token: string) {
  fs.writeFileSync(FALLBACK_TOKEN_PATH, JSON.stringify({ refresh_token: token }), { mode: 0o600 });
  console.log('[Google Auth] Refresh token saved to local tokens.json');
}

async function getRefreshToken(): Promise<string | null> {
  if (fs.existsSync(FALLBACK_TOKEN_PATH)) {
    try {
      const content = fs.readFileSync(FALLBACK_TOKEN_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.refresh_token) return parsed.refresh_token;
    } catch (e) {
      return null;
    }
  }
  return null;
}
