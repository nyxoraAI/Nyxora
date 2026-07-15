import fs from 'fs';
import path from 'path';
import { getPath } from '../config/paths';

const CREDENTIALS_PATH = getPath('google-credentials.json');
const FALLBACK_TOKEN_PATH = getPath('google-tokens.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/contacts.readonly'
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

export async function setClientSecret(secretPath: string): Promise<boolean> {
  try {
    const p = path.resolve(secretPath.trim());
    if (!fs.existsSync(p)) {
      console.error(`[Google Auth] Client secret file not found at ${p}`);
      return false;
    }
    const content = fs.readFileSync(p, 'utf8');
    // validate it's valid JSON
    JSON.parse(content);
    fs.copyFileSync(p, CREDENTIALS_PATH);
    return await initGoogleAuth();
  } catch (err) {
    console.error('[Google Auth] Failed to set client secret:', err);
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

export function getAuthUrlCLI(): string | null {
  if (!credentials) return null;

  const params = new URLSearchParams({
    client_id: credentials.client_id,
    redirect_uri: (credentials.redirect_uris && credentials.redirect_uris.length > 0) ? credentials.redirect_uris[0] : 'http://localhost:1',
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function processCallbackCLI(urlOrCode: string): Promise<boolean> {
  if (!credentials) return false;

  let code = urlOrCode;
  let redirectUri = (credentials.redirect_uris && credentials.redirect_uris.length > 0) ? credentials.redirect_uris[0] : 'http://localhost:1';

  if (urlOrCode.startsWith('http')) {
    try {
      const url = new URL(urlOrCode);
      code = url.searchParams.get('code') || urlOrCode;
      const base = url.origin + url.pathname;
      if (base === 'http://localhost/') redirectUri = 'http://localhost';
      else redirectUri = base;
    } catch (e) {
      // Ignore
    }
  }

  try {
    const makeReq = async (rUri: string) => fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: credentials!.client_id,
        client_secret: credentials!.client_secret,
        redirect_uri: rUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    let res = await makeReq(redirectUri);
    let data = await res.json();

    if (res.status === 400 && data.error === 'redirect_uri_mismatch') {
      const altUri = redirectUri === 'http://localhost:1' ? credentials.redirect_uris[0] : 'http://localhost:1';
      res = await makeReq(altUri);
      data = await res.json();
    }

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
    console.error('[Google Auth] Error processing CLI callback:', err);
    return false;
  }
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
  const checkPaths = [
    FALLBACK_TOKEN_PATH, // ~/.nyxora/auth/google-tokens.json
    path.join(path.dirname(FALLBACK_TOKEN_PATH), 'google_token.json') // common typo or copy-paste
  ];

  for (const tokenPath of checkPaths) {
    if (fs.existsSync(tokenPath)) {
      try {
        const content = fs.readFileSync(tokenPath, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.refresh_token) return parsed.refresh_token;
      } catch (e) {
        // Continue checking other paths
      }
    }
  }
  return null;
}
