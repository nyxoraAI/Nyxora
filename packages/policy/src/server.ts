// Hide relative import from TypeScript
try {
  require('../../core/src/utils/safeLogger').initSafeLogger();
} catch (e) {
  // Fallback
}
console.log(`--- SERVER.TS STARTED (PID: ${process.pid}) ---`);

import fs from 'fs';
import http from 'http';
import { createPolicyEngine } from './engine';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Anti-Crash] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Anti-Crash] Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.POLICY_PORT || 3001;
const IS_WINDOWS = process.platform === 'win32';
const POLICY_SOCKET = IS_WINDOWS ? undefined : '/tmp/nyxora-policy.sock';

const app = createPolicyEngine();

console.log('--- APP.LISTEN CALLED ---');
const server = app.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`[Policy Engine] Listening on 127.0.0.1:${PORT} (Secured Local Loopback)`);
});

server.on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[Policy Engine] Port ${PORT} is already in use. Is Nyxora already running?`);
    process.exit(1);
  } else {
    console.error(`[Policy Engine] Server error:`, e);
    process.exit(1);
  }
});

if (!IS_WINDOWS) {
  const udsServer = http.createServer(app);
  if (POLICY_SOCKET && fs.existsSync(POLICY_SOCKET)) fs.unlinkSync(POLICY_SOCKET);
  udsServer.listen(POLICY_SOCKET!, () => {
    console.log(`[Policy Engine] Listening on UDS ${POLICY_SOCKET} (Hyper-Optimized IPC)`);
  });
}

const gracefulShutdown = () => {
  console.log('[Policy Engine] Received shutdown signal. Cleaning up IPC...');
  if (!IS_WINDOWS && POLICY_SOCKET) {
    try {
      if (fs.existsSync(POLICY_SOCKET)) fs.unlinkSync(POLICY_SOCKET);
    } catch {}
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
