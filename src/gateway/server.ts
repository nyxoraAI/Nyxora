import express from 'express';
import cors from 'cors';
import path from 'path';
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

// Intercept console.log and console.error
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  Tracker.addGatewayLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  originalLog.apply(console, args);
};

console.error = function (...args) {
  Tracker.addGatewayLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), { level: 'error' });
  originalError.apply(console, args);
};

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

// API Auth Middleware
app.use('/api', (req, res, next) => {
  const token = req.headers['x-nyxora-token'];
  if (token !== getSessionToken()) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
  next();
});

// Serve static frontend from dashboard/dist
app.use(express.static(path.join(__dirname, '../../dashboard/dist')));

app.get('/api/history', (req, res) => {
  try {
    const history = logger.getHistory();
    // Filter out internal system prompt for the frontend
    const cleanHistory = history.filter((msg: any) => msg.role !== 'system');
    res.json(cleanHistory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/history', (req, res) => {
  try {
    logger.clear();
    Tracker.addEvent('memory.cleared');
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

app.post('/api/transactions/:id/approve', async (req, res) => {
  const id = req.params.id;
  const tx = txManager.getTransaction(id);
  if (!tx || tx.status !== 'pending') return res.status(404).json({ error: 'Transaction not found or not pending' });
  
  try {
    let result = '';
    if (tx.type === 'transfer') {
      result = await executeTransfer(tx.chainName as any, tx.details);
    } else if (tx.type === 'swap') {
      result = await executeSwap(tx.chainName as any, tx.details);
    } else if (tx.type === 'bridge') {
      result = await executeBridge(tx.chainName as any, tx.details);
    } else if (tx.type === 'mint') {
      result = await executeMintNft(tx.chainName as any, tx.details);
    } else if (tx.type === 'custom') {
      result = await executeCustomTx(tx.chainName as any, tx.details);
    }
    
    txManager.updateStatus(id, 'executed', result);
    
    // Add programmatic beautiful message directly to chat
    const prettyMsg = formatTransactionSuccess(tx, result);
    logger.addEntry({ role: 'assistant', content: `✅ Transaction processed:\n\n${prettyMsg}` });
    
    // Add tool message so the UI can render the beautiful JSON widget!
    logger.addEntry({ role: 'tool', name: tx.type === 'swap' ? 'swap_token' : 'transfer_native', content: result });
    
    // Background update to LLM
    processUserInput(`Transaction ${id} was APPROVED and EXECUTED by the user via Dashboard. Result: ${result}`, 'system').catch(() => {});
    
    res.json({ success: true, result });
  } catch (err: any) {
    txManager.updateStatus(id, 'failed', err.message);
    
    // Add programmatic beautiful error message directly to chat
    const prettyError = formatTransactionError(tx, err.message);
    logger.addEntry({ role: 'assistant', content: prettyError });
    
    processUserInput(`Transaction ${id} was APPROVED but FAILED to execute. Error: ${err.message}`, 'system').catch(() => {});
    
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/:id/reject', (req, res) => {
  const id = req.params.id;
  const tx = txManager.getTransaction(id);
  if (!tx || tx.status !== 'pending') return res.status(404).json({ error: 'Transaction not found or not pending' });
  
  txManager.updateStatus(id, 'rejected');
  processUserInput(`Transaction ${id} was REJECTED by the user via Dashboard. Acknowledge this briefly.`, 'system').catch(() => {});
  res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Process input (this will automatically add to memory)
    const response = await processUserInput(message);
    
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback for React Router (Single Page Application)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../dashboard/dist/index.html'));
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
