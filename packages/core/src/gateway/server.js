"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = __importDefault(require("http"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const state_1 = require("../utils/state");
const reasoning_1 = require("../agent/reasoning");
const parser_1 = require("../config/parser");
const tracker_1 = require("./tracker");
const transactionManager_1 = require("../agent/transactionManager");
const limitOrderManager_1 = require("../agent/limitOrderManager");
const pluginManager_1 = require("../system/pluginManager");
const transfer_1 = require("../web3/skills/transfer");
const swapToken_1 = require("../web3/skills/swapToken");
const getBalance_1 = require("../web3/skills/getBalance");
const checkAddress_1 = require("../web3/skills/checkAddress");
const getMyAddress_1 = require("../web3/skills/getMyAddress");
const getPrice_1 = require("../web3/skills/getPrice");
const checkSecurity_1 = require("../web3/skills/checkSecurity");
const checkPortfolio_1 = require("../web3/skills/checkPortfolio");
const marketAnalysis_1 = require("../web3/skills/marketAnalysis");
const createWallet_1 = require("../web3/skills/createWallet");
const limitOrderManager_2 = require("../agent/limitOrderManager");
const bridgeToken_1 = require("../web3/skills/bridgeToken");
const mintNft_1 = require("../web3/skills/mintNft");
const customTx_1 = require("../web3/skills/customTx");
const telegram_1 = require("./telegram");
// Intercept console.log and console.error
const originalLog = console.log;
const originalError = console.error;
console.log = function (...args) {
    tracker_1.Tracker.addGatewayLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    originalLog.apply(console, args);
};
console.error = function (...args) {
    tracker_1.Tracker.addGatewayLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), { level: 'error' });
    originalError.apply(console, args);
};
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express_1.default.json());
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);
// API Auth Middleware
app.use('/api', (req, res, next) => {
    const token = req.headers['x-nyxora-token'];
    if (token !== (0, state_1.getSessionToken)()) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
    }
    next();
});
// Serve Static Dashboard
const dashboardPath = path_1.default.resolve(__dirname, '../../../dashboard/dist');
app.use(express_1.default.static(dashboardPath));
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(dashboardPath, 'index.html'));
});
app.get('/api/history', (req, res) => {
    try {
        const history = reasoning_1.logger.getHistory();
        // Filter out internal system prompt for the frontend
        const cleanHistory = history.filter((msg) => msg.role !== 'system');
        res.json(cleanHistory);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/api/history', (req, res) => {
    try {
        reasoning_1.logger.clear();
        tracker_1.Tracker.addEvent('memory.cleared');
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/config', (req, res) => {
    try {
        const config = (0, parser_1.loadConfig)();
        res.json(config);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/config', (req, res) => {
    try {
        // Save new configuration to file
        (0, parser_1.saveConfig)(req.body);
        tracker_1.Tracker.addEvent('config.updated', { provider: req.body.llm?.provider });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/stats', (req, res) => {
    res.json(tracker_1.Tracker.getStats());
});
app.get('/api/logs', (req, res) => {
    res.json(tracker_1.Tracker.getLogs());
});
app.get('/api/skills', (req, res) => {
    res.json([
        getBalance_1.getBalanceToolDefinition,
        transfer_1.transferToolDefinition,
        getPrice_1.getPriceToolDefinition,
        swapToken_1.swapTokenToolDefinition,
        bridgeToken_1.bridgeTokenToolDefinition,
        mintNft_1.mintNftToolDefinition,
        customTx_1.customTxToolDefinition,
        checkAddress_1.checkAddressToolDefinition,
        getMyAddress_1.getMyAddressToolDefinition,
        checkSecurity_1.checkSecurityToolDefinition,
        checkPortfolio_1.checkPortfolioToolDefinition,
        marketAnalysis_1.marketAnalysisToolDefinition,
        createWallet_1.createWalletToolDefinition,
        limitOrderManager_2.createLimitOrderToolDefinition,
        limitOrderManager_2.listLimitOrdersToolDefinition,
        limitOrderManager_2.cancelLimitOrderToolDefinition
    ]);
});
app.get('/api/transactions', (req, res) => {
    res.json(transactionManager_1.txManager.getPending());
});
app.post('/api/transactions/:id/approve', (req, res) => {
    const id = req.params.id;
    const token = process.env.INTERNAL_AUTH_TOKEN;
    if (!token)
        return res.status(500).json({ error: 'Internal Auth Token missing' });
    const jwtToken = jsonwebtoken_1.default.sign({ service: 'core' }, token, { expiresIn: '1m' });
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
    const proxyReq = http_1.default.request(options, (proxyRes) => {
        res.status(proxyRes.statusCode || 200);
        proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
        res.status(500).json({ error: 'Policy Engine unreachable: ' + e.message });
    });
    proxyReq.end();
});
app.post('/api/transactions/:id/reject', (req, res) => {
    const id = req.params.id;
    const tx = transactionManager_1.txManager.getTransaction(id);
    if (!tx || tx.status !== 'pending')
        return res.status(404).json({ error: 'Transaction not found or not pending' });
    transactionManager_1.txManager.updateStatus(id, 'rejected');
    (0, reasoning_1.processUserInput)(`Transaction ${id} was REJECTED by the user via Dashboard. Acknowledge this briefly.`, 'system').catch(() => { });
    res.json({ success: true });
});
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        // Process input (this will automatically add to memory)
        const response = await (0, reasoning_1.processUserInput)(message);
        res.json({ response });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Fallback for React Router (Single Page Application)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path_1.default.join(dashboardPath, 'index.html'));
    }
    else {
        next();
    }
});
function startServer() {
    pluginManager_1.pluginManager.loadPlugins().then(() => {
        console.log(`[PluginManager] Finished loading external skills.`);
    });
    limitOrderManager_1.limitOrderManager.startMonitor();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🤖 Nyxora API Server running on port ${PORT}`);
        // Start the Telegram bot listener
        (0, telegram_1.startTelegramBot)();
    });
}
// Start server if this file is run directly
if (require.main === module) {
    startServer();
}
