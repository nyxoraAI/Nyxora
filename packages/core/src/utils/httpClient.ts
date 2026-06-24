export class HttpError extends Error {
  public status: number;
  public responseText: string;

  constructor(status: number, message: string, responseText: string = '') {
    super(message);
    this.status = status;
    this.responseText = responseText;
    this.name = 'HttpError';
  }
}

export interface HttpClientOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function safeFetch(url: string | URL, options: HttpClientOptions = {}): Promise<Response> {
  const {
    timeoutMs = 15000,
    retries = 2,
    retryDelayMs = 1000,
    headers = {},
    ...fetchOptions
  } = options;

  const finalHeaders = {
    'User-Agent': DEFAULT_USER_AGENT,
    ...headers
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const externalSignal = fetchOptions.signal as AbortSignal | undefined;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort);
    }

    const cleanup = () => {
      clearTimeout(id);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    };

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        headers: finalHeaders,
        signal: controller.signal
      });
      cleanup();

      // Handle Rate Limits specifically with a forced retry if attempts remain
      if (res.status === 429) {
        if (attempt < retries && !controller.signal.aborted) {
          // Coingecko and others often need longer backoff, exponentially increase
          await delay(retryDelayMs * (attempt + 1) * 2);
          continue;
        }
        throw new HttpError(429, 'API Rate Limit Reached', await res.text().catch(() => ''));
      }

      // Handle Server Errors with retry
      if (res.status >= 500) {
        if (attempt < retries && !controller.signal.aborted) {
          await delay(retryDelayMs * (attempt + 1));
          continue;
        }
        throw new HttpError(res.status, `Server Error: ${res.status}`, await res.text().catch(() => ''));
      }

      return res;

    } catch (error: any) {
      cleanup();
      lastError = error;

      // Do not retry if the external aggregator specifically aborted us
      if (externalSignal && externalSignal.aborted) {
        throw new HttpError(499, 'Client Closed Request', '');
      }

      // AbortError is a timeout
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          await delay(retryDelayMs * (attempt + 1));
          continue;
        }
        throw new HttpError(408, 'Request Timeout', '');
      }

      // Network errors (like fetch failed)
      if (attempt < retries && !controller.signal.aborted) {
        await delay(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  // If we reach here, we failed all retries
  if (lastError instanceof HttpError) throw lastError;
  throw new HttpError(0, `Network Failure: ${lastError?.message || 'Unknown error'}`, '');
}

/**
 * Convenience wrapper for JSON APIs
 */
export async function safeFetchJson<T>(url: string | URL, options?: HttpClientOptions): Promise<T> {
  const res = await safeFetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new HttpError(res.status, `HTTP ${res.status}: ${res.statusText}`, text);
  }
  return await res.json() as T;
}
