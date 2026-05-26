// Intercept token from URL on load
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

if (tokenFromUrl) {
  localStorage.setItem('nyxora_token', tokenFromUrl);
  // Clean URL
  window.history.replaceState({}, document.title, window.location.pathname);
}

export const getToken = () => localStorage.getItem('nyxora_token') || '';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('x-nyxora-token', token);
  }
  
  return fetch(input, {
    ...init,
    headers,
  });
}
