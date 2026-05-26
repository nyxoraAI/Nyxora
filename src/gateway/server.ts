import express from 'express';
import cors from 'cors';
import path from 'path';
import * as dotenv from 'dotenv';
import { getPath } from '../config/paths';

dotenv.config({ path: getPath('.env') });

import { processUserInput, logger } from '../agent/reasoning';
import { loadConfig, saveConfig } from '../config/parser';
import { Tracker } from './tracker';
import { getBalanceToolDefinition } from '../web3/skills/getBalance';
import { transferToolDefinition } from '../web3/skills/transfer';
import { getPriceToolDefinition } from '../web3/skills/getPrice';
import { swapTokenToolDefinition } from '../web3/skills/swapToken';
import { startTelegramBot } from './telegram';

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
app.use(cors());
app.use(express.json());

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
    swapTokenToolDefinition
  ]);
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
