import express from 'express';
import cors from 'cors';
import { safeFetch } from '../utils/httpClient';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Anti-Crash] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Anti-Crash] Uncaught Exception:', error);
  process.exit(1);
});

import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import os from 'os';
import { getPath } from '../config/paths';
import { validateToken, getSessionToken } from '../utils/state';

import { initWebSocket } from './WebSocketManager';
import fs from 'fs';
import yaml from 'yaml';
import { processUserInput, logger } from '../agent/reasoning';
import { loadConfig, saveConfig, loadRpcConfig, saveRpcConfig } from '../config/parser';
import { loadDefiKeys, saveDefiKeys } from '../config/defiConfigManager';
import { getPublicClient, SUPPORTED_CHAIN_NAMES, getAddress } from '../web3/config';
import { TOKEN_MAP, ERC20_ABI } from '../web3/utils/tokens';
import { Tracker } from './tracker';
import { txManager } from '../agent/transactionManager';
import multer from 'multer';

import { executeTransfer, transferToolDefinition } from '../web3/skills/transfer';
import { executeSwap, swapTokenToolDefinition } from '../web3/skills/swapToken';
import { getBalanceToolDefinition } from '../web3/skills/getBalance';
import { checkAddressToolDefinition } from '../web3/skills/checkAddress';
import { getMyAddressToolDefinition } from '../web3/skills/getMyAddress';
import { manageCustomTokensDefinition } from '../web3/skills/manageCustomTokens';
import { getPriceToolDefinition } from '../web3/skills/getPrice';
import { checkSecurityToolDefinition } from '../web3/skills/checkSecurity';
import { checkPortfolioToolDefinition } from '../web3/skills/checkPortfolio';
import { marketAnalysisToolDefinition } from '../web3/skills/marketAnalysis';
import { executeApprove, executeAaveSupply, executeVaultDeposit, executeUniv3Mint } from '../web3/skills/executeDefi';
import { executeRevokeApproval } from '../web3/skills/revokeApprovals';
import { isSkillActive, toggleSkill, syncAllSkillsToConfig } from '../utils/skillManager';
import { executeBridge, bridgeTokenToolDefinition } from '../web3/skills/bridgeToken';
import { executeMintNft, mintNftToolDefinition } from '../web3/skills/mintNft';
import { executeCustomTx, customTxToolDefinition } from '../web3/skills/customTx';
import { aaveSupplyToolDefinition } from '../web3/skills/defiLending';
import { revokeApprovalToolDefinition } from '../web3/skills/revokeApprovals';
import { vaultDepositToolDefinition } from '../web3/skills/yieldVault';
import { provideLiquidityToolDefinition } from '../web3/skills/provideLiquidity';
import { getTxHistoryToolDefinition } from '../web3/skills/getTxHistory';
import { checkRegistryStatus, checkRegistryStatusToolDefinition } from '../web3/skills/checkRegistryStatus';
import { createLimitOrderToolDefinition } from '../web3/skills/createLimitOrder';
import { getUserWhitelist, saveTokenToWhitelist, removeTokenFromWhitelist } from '../utils/userWhitelistManager';
import { getTokenMetadata } from '../web3/utils/tokens';
import { ChainName } from '../web3/config';

// System Skills
import { browseWebsiteToolDefinition } from '../system/skills/browseWeb';
import { runTerminalCommandToolDefinition } from '../system/skills/executeShell';

import { readLocalFileToolDefinition } from '../system/skills/readFile';
import { editLocalFileToolDefinition } from '../system/skills/editFile';
import { gitManagerToolDefinition } from '../system/skills/gitManager';
import { xManagerToolDefinition } from '../system/skills/xManager';
import { notionWorkspaceToolDefinition } from '../system/skills/notionWorkspace';
import { audioTranscribeToolDefinition } from '../system/skills/audioTranscribe';
import { summarizeTextToolDefinition } from '../system/skills/summarizeText';
import { scheduleTaskDefinition } from '../system/skills/scheduleTask';
import { cancelTaskDefinition } from '../system/skills/cancelTask';
import { cronManager } from '../agent/cronManager';
import { updateSecurityPolicyToolDefinition } from '../system/skills/updateSecurityPolicy';
import { writeLocalFileToolDefinition } from '../system/skills/writeFile';
import { generateExcelToolDefinition } from '../system/skills/generateExcel';
import { analyzeDocumentToolDefinition } from '../system/skills/analyzeDocument';
import { searchWebToolDefinition } from '../system/skills/searchWeb';
import { readGmailInboxToolDefinition, listCalendarEventsToolDefinition, appendRowToSheetsToolDefinition, readGoogleDocsToolDefinition, readGoogleFormResponsesToolDefinition } from '../system/skills/googleWorkspace';

import { startTelegramBot } from './telegram';
import { startBridgeWatcher } from '../agent/bridgeWatcher';
import { eventListener } from '../web3/eventListener';
import { formatTransactionSuccess, formatTransactionError } from '../utils/formatter';
import { initGoogleAuth, getAuthUrl, processCallback, isAuthenticated, logoutGoogle } from './googleAuthModule';
import { generatePrivacyPolicyHtml, generateTosHtml } from './legalGenerator';
import { episodicDB } from '../memory/episodic';
import { ReflectionEngine } from '../memory/reflection';

// Initialize Google Auth
initGoogleAuth();

// Synchronize all active skills to config.yaml on startup
syncAllSkillsToConfig();

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://raw.githubusercontent.com', 'https://logos.covalenthq.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'https://*']
    }
  }
}));
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
  const allowedPaths = ['/api/auth/google/url', '/api/auth/google/callback', '/api/auth/google/status', '/api/auth/google'];
  const currentPath = req.originalUrl.split('?')[0];
  if (allowedPaths.includes(currentPath) || allowedPaths.includes(currentPath.replace(/\/$/, ''))) {
    return next();
  }

  const token = req.headers['x-nyxora-token'] as string;
  const validation = validateToken(token);
  
  if (!validation.valid) {
    console.error(`[Auth] Rejected ${req.method} ${req.originalUrl} - Received invalid token.`);
    return res.status(401).json({ error: `Unauthorized: Invalid or missing token.` });
  }
  
  next();
});

// Serve Static Dashboard
// __dirname is packages/core/dist/gateway (compiled) OR packages/core/src/gateway (dev)
let dashboardPath = path.join(__dirname, '..', '..', '..', 'dashboard', 'dist'); // Dev
if (!fs.existsSync(dashboardPath)) {
  dashboardPath = path.join(__dirname, '..', '..', '..', '..', '..', 'packages', 'dashboard', 'dist'); // Compiled
}
app.use(express.static(dashboardPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

app.get('/privacy', (req, res) => {
  res.send(generatePrivacyPolicyHtml());
});

app.get('/tos', (req, res) => {
  res.send(generateTosHtml());
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const docsDir = path.join(os.homedir(), '.nyxora', 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    cb(null, docsDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    return res.json({ filePath: req.file.path });
  } catch (err) {
    console.error('[Upload] Error:', err);
    return res.status(500).json({ error: 'Failed to save file' });
  }
});

app.post('/api/upload-google-credentials', (req, res) => {
  try {
    const credentials = req.body.credentials;
    if (!credentials) {
      return res.status(400).json({ error: 'Missing credentials payload' });
    }
    
    // Save to ~/.nyxora/google-credentials.json
    const credsPath = getPath('google-credentials.json');
    
    // The format needs to wrap it in "web" or "installed"
    const finalPayload = credentials.client_id ? { installed: credentials } : credentials;
    
    fs.writeFileSync(credsPath, JSON.stringify(finalPayload, null, 2));
    
    // Re-initialize google auth module
    initGoogleAuth();
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

app.get('/api/rpc', (req, res) => {
  try {
    const rpcConfig = loadRpcConfig();
    res.json(rpcConfig);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rpc', (req, res) => {
  try {
    const currentRpc = loadRpcConfig();
    const newRpc = { ...currentRpc, ...req.body };
    saveRpcConfig(newRpc);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/defi-keys', (req, res) => {
  try {
    const keys = loadDefiKeys();
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v && v.trim().length > 0) masked[k] = 'IS_SET';
    }
    res.json(masked);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/defi-keys', (req, res) => {
  try {
    saveDefiKeys(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
  manageCustomTokensDefinition,
  aaveSupplyToolDefinition,
  revokeApprovalToolDefinition,
  vaultDepositToolDefinition,
  provideLiquidityToolDefinition,
  getTxHistoryToolDefinition,
  createLimitOrderToolDefinition,
  checkRegistryStatusToolDefinition
];

const systemSkills = [
  runTerminalCommandToolDefinition,
  readLocalFileToolDefinition,
  writeLocalFileToolDefinition,
  generateExcelToolDefinition,
  browseWebsiteToolDefinition,
  updateSecurityPolicyToolDefinition,

  analyzeDocumentToolDefinition,
  searchWebToolDefinition,
  readGmailInboxToolDefinition,
  listCalendarEventsToolDefinition,
  appendRowToSheetsToolDefinition,
  readGoogleDocsToolDefinition,
  readGoogleFormResponsesToolDefinition,
  editLocalFileToolDefinition,
  gitManagerToolDefinition,
  xManagerToolDefinition,
  notionWorkspaceToolDefinition,
  audioTranscribeToolDefinition,
  summarizeTextToolDefinition,
  scheduleTaskDefinition,
  cancelTaskDefinition
];

app.get('/api/stats', (req, res) => {
  const stats = Tracker.getStats();
  const dbPath = getPath('memory.db');
  
  const activeWeb3 = allSkills.filter(s => isSkillActive(s.function.name)).length;
  const activeSystem = systemSkills.filter(s => isSkillActive(s.function.name)).length;
  
  const totalSkills = allSkills.length + systemSkills.length;
  const activeSkills = activeWeb3 + activeSystem;

  res.json({ ...stats, memoryPath: dbPath, totalSkills, activeSkills });
});

app.get('/api/logs', (req, res) => {
  res.json(Tracker.getLogs());
});

app.get('/api/cron', (req, res) => {
  res.json({
    activeJobs: cronManager.getActiveJobsCount(),
    jobs: cronManager.getJobs()
  });
});

app.get('/api/skills', (req, res) => {
  const skillsWithStatus = allSkills.map(skill => ({
    ...skill,
    isActive: isSkillActive(skill.function.name)
  }));
  
  res.json(skillsWithStatus);
});

app.get('/api/skills/system', (req, res) => {
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

// Portfolio Whitelist Routes
app.get('/api/portfolio/whitelist', async (req, res) => {
  const whitelist = getUserWhitelist();
  res.json(whitelist);
});

app.post('/api/portfolio/whitelist', async (req, res) => {
  const { walletAddress, chainName, tokenAddress, symbol, decimals } = req.body;
  if (!walletAddress || !chainName || !tokenAddress) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  await saveTokenToWhitelist(walletAddress, chainName, tokenAddress, 'manual', symbol, decimals);
  res.json({ success: true });
});

app.delete('/api/portfolio/whitelist', (req, res) => {
  const { walletAddress, chainName, tokenAddress } = req.body;
  if (!walletAddress || !chainName || !tokenAddress) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  removeTokenFromWhitelist(walletAddress, chainName, tokenAddress);
  res.json({ success: true });
});

app.get('/api/portfolio/token-metadata', async (req, res) => {
  const { chain, address } = req.query;
  if (!chain || !address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing chain or address' });
  }
  try {
    const client = getPublicClient(chain as ChainName);
    const metadata = await getTokenMetadata(client, address as `0x${string}`);
    res.json(metadata);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

let lastUnlockRequest = 0;

app.post('/api/status/unlock', (req, res) => {
  lastUnlockRequest = Date.now();
  res.json({ success: true });
});

app.get('/api/status/lock', (req, res) => {
  res.json({ lastUnlockRequest });
});

app.get('/api/transactions', (req, res) => {
  res.json(txManager.getPending());
});

app.post('/api/transactions/:id/approve', async (req, res) => {
  try {
    const id = req.params.id;
    const { sessionId, nonce } = req.body || {};
    const tx = txManager.getTransaction(id);
    if (!tx || tx.status !== 'pending') return res.status(404).json({ error: 'Transaction not found or not pending' });

    if (tx.nonce !== nonce) {
      return res.status(403).json({ error: 'Invalid or missing nonce. Replay attack detected.' });
    }
    
    // --- Arbitrum Registry Kill-Switch Interceptor ---
    const registryCheck = await checkRegistryStatus();
    if (!registryCheck.isActive) {
      txManager.updateStatus(id, 'failed', registryCheck.reason);
      logger.addEntry({ role: 'assistant', content: `❌ **Security Blocked:** ${registryCheck.reason}` }, sessionId);
      return res.status(403).json({ error: `[On-Chain Policy] ${registryCheck.reason}` });
    }
    // ------------------------------------------------

    // Invalidate the nonce immediately to prevent replay
    tx.nonce = 'used_' + Date.now();

    txManager.updateStatus(id, 'approved', 'Executing on-chain...');
    res.json({ success: true, status: 'processing', message: 'Transaction submitted to background processing.' });

    // Execute in background
    (async () => {
      try {
        let result = '';
        if (tx.type === 'transfer') {
          const hash = await executeTransfer(tx.chainName as any, tx.details, true);
          result = `Successfully transferred ${tx.details.amountStr || tx.details.amountEth || '0'} on ${tx.chainName} to ${tx.details.toAddress || tx.details.recipient} (Hash: ${hash})`;
        } else if (tx.type === 'swap') {
          const hash = await executeSwap(tx.chainName as any, tx.details, true);
          result = `Successfully transferred ${tx.details.amountStr || '0'} on ${tx.chainName} to ${tx.chainName} swap contract (Hash: ${hash})`;
        } else if (tx.type === 'bridge') {
          const hash = await executeBridge(tx.chainName as any, tx.details, true);
          result = `Successfully transferred ${tx.details.amount || '0'} on ${tx.chainName} to ${tx.details.toChain} bridge (Hash: ${hash})`;
        } else if (tx.type === 'mint') {
          const hash = await executeMintNft(tx.chainName as any, tx.details, true);
          result = `Successfully transferred 0 on ${tx.chainName} to mint contract (Hash: ${hash})`;
        } else if (tx.type === 'custom') {
          result = await executeCustomTx(tx.chainName as any, tx.details, true);
        } else if (tx.type === 'approve') {
          result = await executeApprove(tx.chainName as any, tx.details);
        } else if (tx.type === 'aaveSupply') {
          result = await executeAaveSupply(tx.chainName as any, tx.details);
        } else if (tx.type === 'vaultDeposit') {
          result = await executeVaultDeposit(tx.chainName as any, tx.details);
        } else if (tx.type === 'univ3Mint') {
          result = await executeUniv3Mint(tx.chainName as any, tx.details);
        } else if (tx.type === 'revokeApproval') {
          const hash = await executeRevokeApproval(tx.chainName as any, tx.details, true);
          result = `Successfully revoked approval for ${tx.details.tokenAddress} from ${tx.details.spenderAddress} on ${tx.chainName} (Hash: ${hash})`;
        }

        const typeToTool: Record<string, string> = {
          'transfer': 'transfer_token',
          'swap': 'swap_token',
          'bridge': 'bridge_token',
          'mint': 'mint_nft',
          'custom': 'execute_custom_tx',
          'approve': 'approve_token',
          'aaveSupply': 'aave_supply',
          'vaultDeposit': 'vault_deposit',
          'univ3Mint': 'univ3_mint',
          'revokeApproval': 'revoke_approval'
        };
        const toolName = typeToTool[tx.type] || 'transfer_native';

        if (!result) {
          result = 'Transaction executed successfully (No Output)';
        }
        
        if (typeof result === 'string' && result.startsWith('Failed to execute')) {
          let errorMsg = result;
          if (result.toLowerCase().includes('insufficient funds') || result.toLowerCase().includes('exceeds the balance')) {
            errorMsg = "Insufficient Coin/Token balance to cover the transaction amount and Gas (Network Fee).";
          } else {
            errorMsg = result.replace('Failed to execute ', '');
          }
          
          txManager.updateStatus(id, 'failed', errorMsg);
          logger.addEntry({ role: 'tool', name: toolName, content: `Failed: ${errorMsg}` }, sessionId);
          logger.addEntry({ role: 'assistant', content: `❌ **Transaction Failed**\n\n${errorMsg}` }, sessionId);
        } else {
          txManager.updateStatus(id, 'executed', result);
          logger.addEntry({ role: 'tool', name: toolName, content: `Success: ${result}` }, sessionId);
          logger.addEntry({ role: 'assistant', content: `✅ **Transaction Executed Successfully**\n\n${result}` }, sessionId);
        }
      } catch (err: any) {
        const typeToTool: Record<string, string> = { 'transfer': 'transfer_token', 'swap': 'swap_token' };
        const toolName = typeToTool[tx.type] || 'transfer_native';
        txManager.updateStatus(id, 'failed', err.message);
        logger.addEntry({ role: 'tool', name: toolName, content: `Failed: ${err.message}` }, sessionId);
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
    const typeToTool: Record<string, string> = {
      'transfer': 'transfer_token',
      'swap': 'swap_token',
      'bridge': 'bridge_token',
      'mint': 'mint_nft',
      'custom': 'execute_custom_tx',
      'approve': 'approve_token',
      'aaveSupply': 'aave_supply',
      'vaultDeposit': 'vault_deposit',
      'univ3Mint': 'univ3_mint'
    };
    const toolName = typeToTool[tx.type] || 'transfer_native';
    
    logger.addEntry({ role: 'tool', name: toolName, content: 'User rejected the transaction. CRITICAL: DO NOT retry or recreate this transaction.' }, sessionId || 'default');
    
    logger.addEntry({ role: 'assistant', content: `❌ **Transaction Cancelled**\n\nYou have cancelled this transaction.` }, sessionId || 'default');
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

let cachedTrending: string[] | null = null;
let lastTrendingFetch = 0;

let cachedPrices: Record<string, number> = {};
let cachedPriceChanges: Record<string, number> = {};
let lastPricesFetch = 0;

app.get('/api/trending', async (req, res) => {
  const now = Date.now();
  if (cachedTrending && now - lastTrendingFetch < 5 * 60 * 1000) {
    return res.json(cachedTrending);
  }
  try {
    const response = await safeFetch('https://api.coingecko.com/api/v3/search/trending');
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

app.get('/api/wallet', async (req, res) => {
  try {
    const userAddress = await getAddress();
    res.json({ address: userAddress });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const userAddress = await getAddress();
    const whitelist = getUserWhitelist();
    const userCustomTokens = whitelist[userAddress.toLowerCase()] || [];

    const portfolio: Record<string, any[]> = {};
    
    await Promise.all(SUPPORTED_CHAIN_NAMES.map(async (chainName) => {
      portfolio[chainName] = [];
      try {
        const publicClient = getPublicClient(chainName as any);
        
        // 1. Get Native Balance
        const nativeBal = await publicClient.getBalance({ address: userAddress as `0x${string}` });
        if (nativeBal > 0n) {
          portfolio[chainName].push({
            symbol: chainName === 'bsc' ? 'BNB' : chainName === 'polygon' ? 'POL' : 'ETH',
            address: 'native',
            balanceRaw: nativeBal.toString(),
            decimals: 18,
            isNative: true
          });
        }

        // 2. Combine TOKEN_MAP and YAML whitelist for this chain
        const tokensToQuery = { ...((TOKEN_MAP as any)[chainName] || {}) };
        
        // Inject whitelisted tokens
        userCustomTokens.forEach(t => {
          if (t.chainName === chainName && t.symbol && t.address) {
            tokensToQuery[t.symbol.toUpperCase()] = t.address;
          }
        });

        // 3. Query all ERC-20 balances in parallel
        await Promise.all(Object.entries(tokensToQuery).map(async ([symbol, address]) => {
          if (address === '0x0000000000000000000000000000000000000000') return; // Skip native placeholder
          try {
            const balPromise = publicClient.readContract({
              address: address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [userAddress as `0x${string}`]
            } as any);
            const decPromise = publicClient.readContract({
              address: address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'decimals'
            } as any);

            const [bal, decimals] = await Promise.all([balPromise, decPromise]) as [bigint, number];
            const isCustom = userCustomTokens.some(t => t.chainName === chainName && t.address === address);
            
            if (bal > 0n || isCustom) {
              portfolio[chainName].push({
                symbol,
                address,
                balanceRaw: bal.toString(),
                decimals: decimals, // Now using actual on-chain decimals
                isNative: false
              });
            }
          } catch (e) {
            // Ignore read errors
          }
        }));
      } catch (e) {
        console.error(`Portfolio error on ${chainName}:`, e);
      }
    }));

    // --- DexScreener Price Fetching ---
    const addressesToFetch = new Set<string>();
    const wrapMap: any = {
      ethereum: 'WETH', arbitrum: 'WETH', base: 'WETH', optimism: 'WETH', sepolia: 'WETH', base_sepolia: 'WETH',
      bsc: 'WBNB', polygon: 'WMATIC'
    };

    for (const chain of Object.keys(portfolio)) {
      for (const t of portfolio[chain]) {
        if (t.isNative) {
           const wToken = wrapMap[chain] || 'WETH';
           const wAddr = ((TOKEN_MAP as any)[chain]?.[wToken]) || '';
           if (wAddr) addressesToFetch.add(wAddr.toLowerCase());
        } else {
           addressesToFetch.add(t.address.toLowerCase());
        }
      }
    }

    const uniqueAddrs = Array.from(addressesToFetch);
    const now = Date.now();
    let priceMap = cachedPrices;
    let changeMap = cachedPriceChanges;

    if (uniqueAddrs.length > 0 && now - lastPricesFetch > 2 * 60 * 1000) {
      try {
        const newPrices: Record<string, number> = {};
        const newChanges: Record<string, number> = {};
        
        await Promise.all(uniqueAddrs.map(async (addr) => {
          try {
            const res = await safeFetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
            if (res.ok) {
              const data = await res.json();
              if (data.pairs && data.pairs.length > 0) {
                 // Find the pair with highest liquidity
                 let bestPair = data.pairs[0];
                 let maxLiq = 0;
                 for (const p of data.pairs) {
                    const liq = p.liquidity?.usd || 0;
                    if (liq > maxLiq) {
                       maxLiq = liq;
                       bestPair = p;
                    }
                 }
                 
                 // Calculate price from bestPair
                 if (bestPair.priceUsd) {
                   const baseAddr = bestPair.baseToken.address.toLowerCase();
                   const quoteAddr = bestPair.quoteToken?.address?.toLowerCase();
                   
                   if (baseAddr === addr) {
                     newPrices[addr] = parseFloat(bestPair.priceUsd);
                     newChanges[addr] = bestPair.priceChange?.h24 || 0;
                   } else if (quoteAddr === addr && bestPair.priceNative && parseFloat(bestPair.priceNative) > 0) {
                     newPrices[addr] = parseFloat(bestPair.priceUsd) / parseFloat(bestPair.priceNative);
                     newChanges[addr] = bestPair.priceChange?.h24 || 0;
                   }
                 }
              }
            }
          } catch (e) {
            console.error(`DexScreener error for ${addr}:`, e);
          }
        }));
        
        console.log('DexScreener Fetched Prices:', newPrices);
        
        cachedPrices = { ...cachedPrices, ...newPrices };
        cachedPriceChanges = { ...cachedPriceChanges, ...newChanges };
        priceMap = cachedPrices;
        changeMap = cachedPriceChanges;
        lastPricesFetch = now;
      } catch (e) {
        console.error('DexScreener fetch error:', e);
      }
    }

    for (const chain of Object.keys(portfolio)) {
      for (const t of portfolio[chain]) {
        let lookupAddr = t.address.toLowerCase();
        if (t.isNative) {
           const wToken = wrapMap[chain] || 'WETH';
           lookupAddr = (((TOKEN_MAP as any)[chain]?.[wToken]) || '').toLowerCase();
        }
        t.priceUsd = priceMap[lookupAddr] || 0;
        t.priceChange24h = changeMap[lookupAddr] || 0;
      }
    }

    res.json(portfolio);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Memory Triggers ---
let messageCounter = 0;
let idleTimer: NodeJS.Timeout | null = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log('[Memory] Idle trigger activated. Running Reflection Engine...');
    ReflectionEngine.runReflection();
  }, 3 * 60 * 1000); // 3 minutes idle
}

app.post('/api/v1/trade', async (req, res) => {
  try {
    const { message, session_id } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    
    const traceId = crypto.randomBytes(8).toString('hex');
    
    // Asynchronous background execution
    processUserInput(message, session_id || traceId).catch(err => {
      console.error(`[TradeAPI] Error:`, err);
    });

    res.status(200).json({ status: 'processing', traceId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    
    // Memory Triggers
    resetIdleTimer();
    messageCounter++;
    if (messageCounter >= 5) {
      console.log('[Memory] N-Message threshold reached. Running Reflection Engine...');
      messageCounter = 0;
      // Run asynchronously
      ReflectionEngine.runReflection();
    }

    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Memory API Endpoints ---
app.get('/api/memory', (req, res) => {
  try {
    const memories = episodicDB.getMemories();
    res.json(memories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/memory/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    episodicDB.deleteMemory(id);
    // When memory is deleted manually, trigger promotion engine to resync user.md
    // To avoid circular dependency inside server.ts, we import here or assume it updates next cycle
    const { PromotionEngine } = require('../memory/promotionEngine');
    PromotionEngine.runPromotionAndDecay();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Policy Engine Endpoints ---
app.get('/api/policy', (req, res) => {
  try {
    const policyPath = getPath('policy.yaml');
    if (!fs.existsSync(policyPath)) {
      return res.json({
        max_usd_per_tx: 999999999,
        whitelist_only: false,
        require_approval: true,
        custom_llm_rules: []
      });
    }
    const file = fs.readFileSync(policyPath, 'utf8');
    const parsed = yaml.parse(file) || {};
    res.json({
      max_usd_per_tx: parsed.max_usd_per_tx ?? 999999999,
      whitelist_only: parsed.whitelist_only ?? false,
      require_approval: parsed.require_approval ?? true,
      custom_llm_rules: parsed.custom_llm_rules || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/policy', (req, res) => {
  try {
    const policyPath = getPath('policy.yaml');
    let current = {};
    if (fs.existsSync(policyPath)) {
      current = yaml.parse(fs.readFileSync(policyPath, 'utf8')) || {};
    }
    const updated = { ...current, ...req.body };
    fs.writeFileSync(policyPath, yaml.stringify(updated), 'utf8');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- User Persona / Risk Profile Endpoints (V3) ---
app.get('/api/profile', (req, res) => {
  try {
    const profile = logger.getUserProfile();
    res.json(profile || { risk_level: 'Moderate', max_slippage: 1.0, avoid_memecoins: false, custom_rules: '' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profile', (req, res) => {
  try {
    logger.updateUserProfile(req.body);
    res.json({ success: true });
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

export async function autoMigrateKeys() {
  const vaultPath = getPath('api_vault.key');
  let extractedKeys: Record<string, string> = {};
  
  try {
    const { Entry } = require('@napi-rs/keyring');
    const entry = new Entry('nyxora', 'api_keys');
    const data = await entry.getPassword();
    if (data) {
      extractedKeys = JSON.parse(data);
      await entry.deletePassword();
      console.log('[Auto-Migrate] Migrated legacy keys from OS Keyring.');
    }
  } catch (e) {}

  if (Object.keys(extractedKeys).length === 0 && fs.existsSync(vaultPath)) {
    try {
      const file = fs.readFileSync(vaultPath, 'utf8');
      extractedKeys = JSON.parse(file);
      fs.unlinkSync(vaultPath);
      console.log('[Auto-Migrate] Migrated legacy keys from api_vault.key.');
    } catch (e) {}
  }

  if (Object.keys(extractedKeys).length > 0) {
    const config = loadConfig();
    config.credentials = { ...config.credentials, ...extractedKeys };
    saveConfig(config);
    console.log('[Auto-Migrate] Successfully injected legacy keys into config.yaml.');
  }
}

export function startServer() {
  autoMigrateKeys().catch(e => console.error('[Auto-Migrate] Error:', e));



  const PORT = Number(process.env.PORT || 3000);
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`🤖 Nyxora API Server running on port ${PORT}`);
    
    // Initialize WebSocket Manager
    initWebSocket(server);
    
    // Start the Telegram bot listener
    startTelegramBot();
    
    // Start Asynchronous Bridge Watcher
    startBridgeWatcher();
    
    // Start Event Listener for Limit Orders (V3)
    eventListener.start();
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`[Nyxora Gateway] Port ${PORT} is already in use. Is Nyxora already running?`);
      process.exit(1);
    } else {
      console.error(`[Nyxora Gateway] Server error:`, e);
      process.exit(1);
    }
  });

  let isShuttingDown = false;
  const gracefulShutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('[Nyxora Gateway] Received shutdown signal. Closing server...');
    
    if (server.closeAllConnections) {
      server.closeAllConnections();
    }

    server.close(() => {
      console.log('[Nyxora Gateway] HTTP server closed.');
      logger.close();
      process.exit(0);
    });
    
    // Force exit after 3s if stuck
    setTimeout(() => {
      console.error('[Nyxora Gateway] Forced shutdown.');
      process.exit(1);
    }, 3000).unref();
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
