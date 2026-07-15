import { getSystemPrompt } from '../packages/core/src/agent/promptBuilder';

async function testPromptBuilder() {
    console.log("=== Testing Prompt Builder ===");
    try {
        const osPrompt = await getSystemPrompt('os', 'test message');
        console.log(`[PASS] OS System prompt generated successfully. Length: ${osPrompt.length}`);
        
        const web3Prompt = await getSystemPrompt('web3', 'test message');
        console.log(`[PASS] Web3 System prompt generated successfully. Length: ${web3Prompt.length}`);
    } catch (error) {
        console.error("[FAIL] Prompt Builder test failed:", error);
    }
}
// testPromptBuilder();
