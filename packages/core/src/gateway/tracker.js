"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tracker = void 0;
const stats = {
    cost: 0,
    tokens: 0,
    messages: 0
};
const eventLogs = [];
const gatewayLogs = [];
const MAX_LOGS = 100;
function formatTime() {
    const now = new Date();
    return now.toTimeString().split(' ')[0]; // Returns HH:MM:SS
}
exports.Tracker = {
    addTokens: (amount, provider) => {
        stats.tokens += amount;
        // Simple mock cost calculation
        let rate = 0;
        if (provider === 'openai')
            rate = 0.00002;
        else if (provider === 'gemini')
            rate = 0.00001;
        stats.cost += (amount * rate);
    },
    addMessage: () => {
        stats.messages += 1;
    },
    getStats: () => {
        return { ...stats, cost: Number(stats.cost.toFixed(4)) };
    },
    addEvent: (event, meta = {}) => {
        eventLogs.unshift({ timestamp: formatTime(), event, meta });
        if (eventLogs.length > MAX_LOGS)
            eventLogs.pop();
    },
    addGatewayLog: (message, meta) => {
        gatewayLogs.unshift({ timestamp: formatTime(), message, meta });
        if (gatewayLogs.length > MAX_LOGS)
            gatewayLogs.pop();
    },
    getLogs: () => {
        return {
            events: eventLogs,
            gateway: gatewayLogs
        };
    }
};
