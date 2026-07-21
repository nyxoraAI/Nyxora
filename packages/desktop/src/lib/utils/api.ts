// Intercept token from URL on load
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

if (tokenFromUrl) {
  localStorage.setItem('nyxora_token', tokenFromUrl);
  // Clean URL
  window.history.replaceState({}, document.title, window.location.pathname);
}

export const getToken = () => localStorage.getItem('nyxora_token') || '';

export const API_BASE_URL = 'http://localhost:3000';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('x-nyxora-token', token);
  }
  
  // If input is a relative path (starts with /), prepend API_BASE_URL
  const url = typeof input === 'string' && input.startsWith('/') 
    ? `${API_BASE_URL}${input}` 
    : input;
    
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new CustomEvent('nyxora-auth-error'));
    }

    window.dispatchEvent(new CustomEvent('nyxora-network-restored'));
    return response;
  } catch (error) {
    window.dispatchEvent(new CustomEvent('nyxora-network-error'));
    throw error;
  }
}
