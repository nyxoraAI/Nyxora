const PRIVATE_KEY_REGEX = /0x[a-fA-F0-9]{64}/g;
const JWT_REGEX = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;

function sanitize(args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return arg
        .replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]')
        .replace(JWT_REGEX, '[REDACTED_JWT]');
    }
    if (arg instanceof Error) {
      const sanitizedError = new Error(arg.message
        .replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]')
        .replace(JWT_REGEX, '[REDACTED_JWT]')
      );
      sanitizedError.stack = arg.stack?.replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]').replace(JWT_REGEX, '[REDACTED_JWT]');
      return sanitizedError;
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        const str = JSON.stringify(arg);
        const sanitizedStr = str
          .replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]')
          .replace(JWT_REGEX, '[REDACTED_JWT]');
        return JSON.parse(sanitizedStr);
      } catch (e) {
        return arg;
      }
    }
    return arg;
  });
}

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

export function initSafeLogger() {
  // @ts-ignore
  if (console.__isSafe) return;
  
  console.log = (...args: any[]) => originalLog(...sanitize(args));
  console.error = (...args: any[]) => originalError(...sanitize(args));
  console.warn = (...args: any[]) => originalWarn(...sanitize(args));
  
  // @ts-ignore
  console.__isSafe = true;
}

export function safeLog(...args: any[]) {
  originalLog(...sanitize(args));
}

export function safeError(...args: any[]) {
  originalError(...sanitize(args));
}

export function safeWarn(...args: any[]) {
  originalWarn(...sanitize(args));
}
