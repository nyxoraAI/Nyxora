const { loadRpcConfig, saveRpcConfig } = require('./packages/core/dist/config/parser.js');
console.log("Current:", loadRpcConfig());
saveRpcConfig({ ...loadRpcConfig(), arbitrum_sepolia: 'https://test-arb' });
console.log("New:", loadRpcConfig());
