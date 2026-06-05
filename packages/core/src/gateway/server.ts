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
import { isSkillActive, toggleSkill } from '../utils/skillManager';
import { executeBridge, bridgeTokenToolDefinition } from '../web3/skills/bridgeToken';
import { executeMintNft, mintNftToolDefinition } from '../web3/skills/mintNft';
import { executeCustomTx, customTxToolDefinition } from '../web3/skills/customTx';

// System Skills
import { browseWebsiteToolDefinition } from '../system/skills/browseWeb';
import { runTerminalCommandToolDefinition } from '../system/skills/executeShell';
import { installExternalSkillToolDefinition } from '../system/skills/installSkill';
import { readLocalFileToolDefinition } from '../system/skills/readFile';
import { updateSecurityPolicyToolDefinition } from '../system/skills/updateSecurityPolicy';
import { writeLocalFileToolDefinition } from '../system/skills/writeFile';
import { analyzeDocumentToolDefinition } from '../system/skills/analyzeDocument';
import { searchWebToolDefinition } from '../system/skills/searchWeb';
import { readGmailInboxToolDefinition, listCalendarEventsToolDefinition, appendRowToSheetsToolDefinition, readGoogleDocsToolDefinition, readGoogleFormResponsesToolDefinition } from '../system/skills/googleWorkspace';

import { startTelegramBot } from './telegram';
import { formatTransactionSuccess, formatTransactionError } from '../utils/formatter';
import { initGoogleAuth, getAuthUrl, processCallback, isAuthenticated, logoutGoogle } from './googleAuthModule';

// Initialize Google Auth
initGoogleAuth();

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
app.use(cors({ 
  origin: function (origin, callback) {
    if (!origin || /^(http:\/\/(localhost|127\.0\.0\.1):\d+)$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'x-nyxora-token']
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // Increased from 100 to 10000 to prevent breaking dashboard polling (which polls every 2s)
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// API Auth Middleware
app.use('/api', (req, res, next) => {
  // Bypass auth for Google OAuth callback and URLs since they are handled externally or by the browser
  if (req.path.startsWith('/auth/google')) {
    return next();
  }

  const token = req.headers['x-nyxora-token'];
  if (token !== getSessionToken()) {
    console.error(`[Auth] Rejected ${req.method} ${req.originalUrl} - Expected: ${getSessionToken().substring(0,8)}... Received: ${token ? token.toString().substring(0,8) + '...' : 'undefined'}`);
    return res.status(401).json({ error: `Unauthorized: Invalid or missing token.` });
  }
  next();
});

// Serve Static Dashboard
const dashboardPath = path.resolve(process.cwd(), 'packages/dashboard/dist');
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
    const currentConfig = loadConfig();
    const newConfig = {
      ...currentConfig,
      ...req.body,
      agent: { ...currentConfig.agent, ...(req.body.agent || {}) },
      llm: { ...currentConfig.llm, ...(req.body.llm || {}) },
      web3: { ...currentConfig.web3, ...(req.body.web3 || {}) }
    };
    // Save merged configuration to file
    saveConfig(newConfig);
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
  const allSkills = [
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
  ];
  
  const skillsWithStatus = allSkills.map(skill => ({
    ...skill,
    isActive: isSkillActive(skill.function.name)
  }));
  
  res.json(skillsWithStatus);
});

app.get('/api/skills/system', (req, res) => {
  const systemSkills = [
    runTerminalCommandToolDefinition,
    readLocalFileToolDefinition,
    writeLocalFileToolDefinition,
    browseWebsiteToolDefinition,
    updateSecurityPolicyToolDefinition,
    installExternalSkillToolDefinition,
    analyzeDocumentToolDefinition,
    searchWebToolDefinition,
    readGmailInboxToolDefinition,
    listCalendarEventsToolDefinition,
    appendRowToSheetsToolDefinition,
    readGoogleDocsToolDefinition,
    readGoogleFormResponsesToolDefinition
  ];
  
  const skillsWithStatus = systemSkills.map(skill => ({
    ...skill,
    isActive: isSkillActive(skill.function.name)
  }));
  
  res.json(skillsWithStatus);
});

app.post('/api/skills/toggle', (req, res) => {
  const { skillName, active } = req.body;
  if (!skillName || typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  toggleSkill(skillName, active);
  res.json({ success: true, skillName, active });
});

// Google Workspace Auth Routes
app.get('/api/auth/google/url', (req, res) => {
  const url = getAuthUrl();
  if (!url) return res.status(500).json({ error: 'Google Auth not configured' });
  res.json({ url });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('No code provided');
  
  const success = await processCallback(code);
  if (success) {
    res.send(`
      <html><body>
      <h2>Authentication Successful!</h2>
      <p>You can close this window and return to the dashboard.</p>
      <script>
        setTimeout(() => window.close(), 2000);
      </script>
      </body></html>
    `);
  } else {
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/auth/google/status', async (req, res) => {
  const connected = await isAuthenticated();
  res.json({ connected });
});

app.delete('/api/auth/google', async (req, res) => {
  const success = await logoutGoogle();
  res.json({ success });
});

app.get('/api/transactions', (req, res) => {
  res.json(txManager.getPending());
});

app.post('/api/transactions/:id/approve', async (req, res) => {
  try {
    const id = req.params.id;
    const { sessionId } = req.body || {};
    const tx = txManager.getTransaction(id);
    if (!tx || tx.status !== 'pending') return res.status(404).json({ error: 'Transaction not found or not pending' });

    txManager.updateStatus(id, 'approved', 'Executing on-chain...');
    res.json({ success: true, status: 'processing', message: 'Transaction submitted to background processing.' });

    // Execute in background
    (async () => {
      try {
        let result = '';
        if (tx.type === 'transfer') {
          result = await executeTransfer(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'swap') {
          result = await executeSwap(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'bridge') {
          result = await executeBridge(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'mint') {
          result = await executeMintNft(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'custom') {
          result = await executeCustomTx(tx.chainName as any, tx.details, true);
        }

        if (result.startsWith('Failed to execute')) {
          let errorMsg = result;
          if (result.toLowerCase().includes('insufficient funds') || result.toLowerCase().includes('exceeds the balance')) {
            errorMsg = "Insufficient Coin/Token balance to cover the transaction amount and Gas (Network Fee).";
          } else {
            errorMsg = result.replace('Failed to execute ', '');
          }
          
          txManager.updateStatus(id, 'failed', errorMsg);
          logger.addEntry({ role: 'tool', name: tx.type === 'swap' ? 'swap_token' : 'transfer_native', content: `Failed: ${errorMsg}` });
          logger.addEntry({ role: 'assistant', content: `❌ **Transaction Failed**\n\n${errorMsg}` }, sessionId);
        } else {
          txManager.updateStatus(id, 'executed', result);
          logger.addEntry({ role: 'tool', name: tx.type === 'swap' ? 'swap_token' : 'transfer_native', content: `Success: ${result}` });
          logger.addEntry({ role: 'assistant', content: `✅ **Transaction Executed Successfully**\n\n${result}` }, sessionId);
        }
      } catch (err: any) {
        txManager.updateStatus(id, 'failed', err.message);
        logger.addEntry({ role: 'assistant', content: `❌ **Transaction Failed**\n\n${err.message}` }, sessionId);
      }
    })();
  } catch (err: any) {
    txManager.updateStatus(req.params.id, 'failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/:id/reject', async (req, res) => {
  try {
    const id = req.params.id;
    const { sessionId } = req.body || {};
    const tx = txManager.getTransaction(id);
    if (!tx || tx.status !== 'pending') return res.status(404).json({ error: 'Transaction not found or not pending' });

    txManager.updateStatus(id, 'rejected');
    logger.addEntry({ role: 'tool', name: tx.type === 'swap' ? 'swap_token' : 'transfer_native', content: 'User rejected the transaction.' });
    
    logger.addEntry({ role: 'assistant', content: `❌ **Transaction Cancelled**\n\nYou have cancelled this transaction.` }, sessionId || 'default');
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🤖 Nyxora API Server running on port ${PORT}`);
    
    // Start the Telegram bot listener
    startTelegramBot();
  });
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
