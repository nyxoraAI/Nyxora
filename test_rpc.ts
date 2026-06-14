import { loadRpcConfig, saveRpcConfig } from './packages/core/src/config/parser';
console.log("Current:", loadRpcConfig());
saveRpcConfig({ ...loadRpcConfig(), arbitrum_sepolia: 'https://test-arb' });
console.log("New:", loadRpcConfig());
