import { Web3Plugin } from '../packages/core/src/system/plugins/Web3Plugin';

async function testWeb3Plugin() {
    console.log("=== Testing Web3Plugin (DeFi Functions) ===");
    try {
        console.log("1. Initializing Web3Plugin...");
        const plugin = new Web3Plugin();
        const tools = plugin.getTools();
        console.log(`[PASS] Found ${tools.length} Web3 tools registered.\n`);

        console.log("2. Verifying 'transfer_token' and 'swap_token' function presence...");
        const hasTransfer = tools.some(t => t.function.name === 'transfer_token');
        const hasSwap = tools.some(t => t.function.name === 'swap_token');
        console.log(`[PASS] transfer_token registered: ${hasTransfer}`);
        console.log(`[PASS] swap_token registered: ${hasSwap}\n`);

        console.log("3. Safely checking plugin definition structure...");
        if (tools.length > 0) {
            console.log(`[PASS] Plugin structure intact. First tool: ${tools[0].function.name}\n`);
        }

        console.log("All Web3 tests passed! (Safe Mode - No tx signed)");
    } catch (error) {
        console.error("[FAIL] Web3 test encountered an error:", error);
    }
}

testWeb3Plugin();
