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
  },
  
  addMessage: () => {
    stats.messages += 1;
  },

  getStats: () => {
    return { ...stats, cost: Number(stats.cost.toFixed(4)) };
  },

  addEvent: (event: string, meta: any = {}) => {
    eventLogs.unshift({ timestamp: formatTime(), event, meta });
    if (eventLogs.length > MAX_LOGS) eventLogs.pop();
  },

  addGatewayLog: (message: string, meta?: any) => {
    gatewayLogs.unshift({ timestamp: formatTime(), message, meta });
    if (gatewayLogs.length > MAX_LOGS) gatewayLogs.pop();
  },

  getLogs: () => {
    return {
      events: eventLogs,
      gateway: gatewayLogs
    };
  }
};
