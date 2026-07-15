import { sanitizeHistoryForLLM } from '../packages/core/src/utils/historySanitizer';

async function testHistorySanitizer() {
    console.log("=== Testing History Sanitizer ===");
    try {
        const dummyHistory = [
            { role: 'user', content: 'test message' },
            { role: 'tool', content: 'A'.repeat(5000) } // Large output
        ];
        const activeTools: any[] = [];
        
        const sanitized = sanitizeHistoryForLLM(dummyHistory, activeTools, 'ollama');
        console.log(`[PASS] Sanitized history length: ${sanitized.length}`);
        
        const toolMsg = sanitized.find(m => m.role === 'user' && m.content.includes('[Tool Result'));
        if (toolMsg) {
            console.log(`[PASS] Tool message successfully truncated. Length: ${toolMsg.content.length}`);
        } else {
            console.log(`[WARN] Could not find truncated tool message.`);
        }
    } catch (error) {
        console.error("[FAIL] History Sanitizer test failed:", error);
    }
}
// testHistorySanitizer();
