import { loadApiKeys, getLlmConfig } from '../packages/core/src/config/parser';

async function testConfigParser() {
    console.log("=== Testing Config Parser ===");
    try {
        const keys = await loadApiKeys();
        console.log(`[PASS] API Keys loaded. Found ${Object.keys(keys).length} keys.`);
        
        const llmConfig = await getLlmConfig();
        console.log(`[PASS] LLM Config loaded. Provider: ${llmConfig.provider}`);
    } catch (error) {
        console.error("[FAIL] Config Parser test failed:", error);
    }
}
// testConfigParser();
