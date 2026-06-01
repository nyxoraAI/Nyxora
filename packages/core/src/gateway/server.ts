import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getPath } from '../config/paths';
import { getSessionToken } from '../utils/state';

import { processUserInput, logger } from '../agent/reasoning';
import { loadConfig, saveConfig } from '../config/parser';
import { Tracker } from './tracker';
import { txManager } from '../agent/transactionManager';
import { limitOrderManager } from '../agent/limitOrderManager';
import { pluginManager } from '../system/pluginManager';
import { executeTransfer, transferToolDefinition } from '../web3/skills/transfer';
import { executeSwap, swapTokenToolDefinition } from '../web3/skills/swapToken';
import { getBalanceToolDefinition } from '../web3/skills/getBalance';
import { checkAddressToolDefinition } from '../web3/skills/checkAddress';
import { getMyAddressToolDefinition } from '../web3/skills/getMyAddress';
import { getPriceToolDefinition } from '../web3/skills/getPrice';
import { checkSecurityToolDefinition } from '../web3/skills/checkSecurity';
import { checkPortfolioToolDefinition } from '../web3/skills/checkPortfolio';
import { marketAnalysisToolDefinition } from '../web3/skills/marketAnalysis';
import { createWalletToolDefinition } from '../web3/skills/createWallet';
import { createLimitOrderToolDefinition, listLimitOrdersToolDefinition, cancelLimitOrderToolDefinition } from '../agent/limitOrderManager';
import { executeBridge, bridgeTokenToolDefinition } from '../web3/skills/bridgeToken';
import { executeMintNft, mintNftToolDefinition } from '../web3/skills/mintNft';
import { executeCustomTx, customTxToolDefinition } from '../web3/skills/customTx';
import { startTelegramBot } from './telegram';
import { formatTransactionSuccess, formatTransactionError } from '../utils/formatter';

import util from 'util';

// Intercept console.log and console.error
const originalLog = console.log;
const originalError = console.error;

const safeFormat = (a: any) => typeof a === 'object' ? util.inspect(a, { depth: 2 }) : String(a);

console.log = function (...args) {
  Tracker.addGatewayLog(args.map(safeFormat).join(' '));
  originalLog.apply(console, args);
};

console.error = function (...args) {
  Tracker.addGatewayLog(args.map(safeFormat).join(' '), { level: 'error' });
  originalError.apply(console, args);
};

const app = express();
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // Increased from 100 to 10000 to prevent breaking dashboard polling (which polls every 2s)
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// API Auth Middleware
app.use('/api', (req, res, next) => {
  const token = req.headers['x-nyxora-token'];
  if (token !== getSessionToken()) {
    return res.status(401).json({ error: `Unauthorized: Invalid or missing token. Expected: ${getSessionToken()}, Received: ${token}` });
  }
  next();
});

// Serve Static Dashboard
const dashboardPath = path.resolve(__dirname, '../../../dashboard/dist');
app.use(express.static(dashboardPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

app.get('/api/history', (req, res) => {
  try {
    const sessionId = req.query.session_id as string | undefined;
    const history = logger.getHistory(sessionId);
    // Filter out internal system prompt for the frontend
    const cleanHistory = history.filter((msg: any) => msg.role !== 'system');
    res.json(cleanHistory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/history', (req, res) => {
  try {
    const sessionId = req.query.session_id as string | undefined;
    logger.clear(sessionId);
    Tracker.addEvent('memory.cleared');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions', (req, res) => {
  try {
    res.json(logger.getSessions());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', (req, res) => {
  try {
    const { title } = req.body;
    const id = logger.createSession(title || 'New Chat');
    res.json({ id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    logger.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:id', (req, res) => {
  try {
    const { title } = req.body;
    if (title) {
      logger.renameSession(req.params.id, title);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    // Save new configuration to file
    saveConfig(req.body);
    Tracker.addEvent('config.updated', { provider: req.body.llm?.provider });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  res.json(Tracker.getStats());
});

app.get('/api/logs', (req, res) => {
  res.json(Tracker.getLogs());
});

app.get('/api/skills', (req, res) => {
  res.json([
    getBalanceToolDefinition,
    transferToolDefinition,
    getPriceToolDefinition,
    swapTokenToolDefinition,
    bridgeTokenToolDefinition,
    mintNftToolDefinition,
    customTxToolDefinition,
    checkAddressToolDefinition,
    getMyAddressToolDefinition,
    checkSecurityToolDefinition,
    checkPortfolioToolDefinition,
    marketAnalysisToolDefinition,
    createWalletToolDefinition,
    createLimitOrderToolDefinition,
    listLimitOrdersToolDefinition,
    cancelLimitOrderToolDefinition
  ]);
});

app.get('/api/transactions', (req, res) => {
  res.json(txManager.getPending());
});

app.post('/api/transactions/:id/approve', (req, res) => {
  const id = req.params.id;
  const token = process.env.INTERNAL_AUTH_TOKEN;
  if (!token) return res.status(500).json({ error: 'Internal Auth Token missing' });

  const jwtToken = jwt.sign({ service: 'core' }, token, { expiresIn: '1m' });

  // Generate Challenge Nonce
  const nonce = crypto.randomBytes(16).toString('hex');
  const approvalHash = crypto.createHash('sha256').update(id + nonce + token).digest('hex');

  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: `/approve-tx/${id}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  };

  const requestPayload = JSON.stringify({ nonce, approvalHash });
  options.headers['Content-Length'] = Buffer.byteLength(requestPayload);

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.status(500).json({ error: 'Policy Engine unreachable: ' + e.message });
  });

  proxyReq.write(requestPayload);
  proxyReq.end();
});

app.post('/api/transactions/:id/reject', (req, res) => {
  const id = req.params.id;
  const tx = txManager.getTransaction(id);
  if (!tx || tx.status !== 'pending') return res.status(404).json({ error: 'Transaction not found or not pending' });
  
  txManager.updateStatus(id, 'rejected');
  processUserInput(`Transaction ${id} was REJECTED by the user via Dashboard. Acknowledge this briefly.`, 'system').catch(() => {});
  res.json({ success: true });
});

let cachedTrending: string[] | null = null;
let lastTrendingFetch = 0;

app.get('/api/trending', async (req, res) => {
  const now = Date.now();
  if (cachedTrending && now - lastTrendingFetch < 5 * 60 * 1000) {
    return res.json(cachedTrending);
  }
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
    if (response.ok) {
      const data = await response.json();
      const top5 = data.coins.slice(0, 5).map((c: any) => '$' + c.item.symbol.toUpperCase());
      cachedTrending = top5;
      lastTrendingFetch = now;
      res.json(top5);
    } else {
      // Fallback if coingecko rate limits
      if (cachedTrending) return res.json(cachedTrending);
      res.status(response.status).json({ error: 'Failed to fetch trending' });
    }
  } catch (err: any) {
    if (cachedTrending) return res.json(cachedTrending);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, session_id } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Process input (this will automatically add to memory)
    const response = await processUserInput(message, 'user', undefined, session_id);
    
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback for React Router (Single Page Application)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(dashboardPath, 'index.html'));
  } else {
    next();
  }
});

export function startServer() {
  pluginManager.loadPlugins().then(() => {
    console.log(`[PluginManager] Finished loading external skills.`);
  });
  limitOrderManager.startMonitor();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🤖 Nyxora API Server running on port ${PORT}`);
    
    // Start the Telegram bot listener
    startTelegramBot();
  });
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
