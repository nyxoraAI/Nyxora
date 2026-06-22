import fs from 'fs';
import path from 'path';
import { wsManager } from './WebSocketManager';
import { getPath } from '../config/paths';

interface Stats {
  cost: number;
  tokens: number;
  messages: number;
}

interface EventLog {
  timestamp: string;
  event: string;
  meta: any;
}

interface GatewayLog {
  timestamp: string;
  message: string;
  meta?: any;
}

const stats: Stats = {
  cost: 0,
  tokens: 0,
  messages: 0
};

const eventLogs: EventLog[] = [];
const gatewayLogs: GatewayLog[] = [];
const MAX_LOGS = 100;

let trackerFile = '';
try {
  trackerFile = getPath('tracker.json');
} catch (e) {
  // Fallback
}

function loadState() {
  if (!trackerFile) return;
  try {
    if (fs.existsSync(trackerFile)) {
      const data = JSON.parse(fs.readFileSync(trackerFile, 'utf8'));
      if (data.stats) Object.assign(stats, data.stats);
      if (data.eventLogs && Array.isArray(data.eventLogs)) {
        eventLogs.splice(0, eventLogs.length, ...data.eventLogs);
      }
      if (data.gatewayLogs && Array.isArray(data.gatewayLogs)) {
        gatewayLogs.splice(0, gatewayLogs.length, ...data.gatewayLogs);
      }
    }
  } catch (e) {}
}

let savePending = false;
function saveState() {
  if (!trackerFile) return;
  if (savePending) return;
  savePending = true;
  setTimeout(() => {
    flushState();
    savePending = false;
  }, 1000);
}

import * as lockfile from 'proper-lockfile';

function flushState() {
  if (!trackerFile) return;
  try {
    if (!fs.existsSync(trackerFile)) fs.writeFileSync(trackerFile, '{}');
    const release = lockfile.lockSync(trackerFile, { retries: 5 });
    fs.writeFileSync(trackerFile, JSON.stringify({ stats, eventLogs, gatewayLogs }));
    release();
  } catch (e) {
    try {
      fs.writeFileSync(trackerFile, JSON.stringify({ stats, eventLogs, gatewayLogs }));
    } catch(err) {}
  }
}

process.on('exit', flushState);
process.on('SIGTERM', () => { flushState(); process.exit(0); });
process.on('SIGINT', () => { flushState(); process.exit(0); });

loadState();

function formatTime(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0]; // Returns HH:MM:SS
}

export const Tracker = {
  addTokens: (amount: number, provider: string) => {
    stats.tokens += amount;
    
    // Simple mock cost calculation
    let rate = 0;
    if (provider === 'openai') rate = 0.00002;
    else if (provider === 'gemini') rate = 0.00001;
    
    stats.cost += (amount * rate);
    saveState();
  },
  
  addMessage: () => {
    stats.messages += 1;
    saveState();
  },

  getStats: () => {
    return { ...stats, cost: Number(stats.cost.toFixed(4)) };
  },

  addEvent: (event: string, meta: any = {}) => {
    eventLogs.unshift({ timestamp: formatTime(), event, meta });
    if (eventLogs.length > MAX_LOGS) eventLogs.pop();
    saveState();
  },

  addGatewayLog: (message: string, meta?: any) => {
    gatewayLogs.unshift({ timestamp: formatTime(), message, meta });
    if (gatewayLogs.length > MAX_LOGS) gatewayLogs.pop();
    saveState();
    
    // Broadcast terminal logs to Dashboard via WebSocket
    if (wsManager) {
      wsManager.broadcastAll(`[${formatTime()}] ${message}`, meta?.level || 'info');
    }
  },

  getLogs: () => {
    return {
      events: eventLogs,
      gateway: gatewayLogs
    };
  }
};
