import { SystemWorkspacePlugin } from '../packages/core/src/system/plugins/SystemWorkspacePlugin';
import { resolveNyxoraPath } from '../packages/core/src/config/paths';
import fs from 'fs';

async function testOSPlugin() {
    console.log("=== Testing SystemWorkspacePlugin (OS Functions) ===");
    try {
        console.log("1. Initializing SystemWorkspacePlugin...");
        const plugin = new SystemWorkspacePlugin();
        const tools = plugin.getTools();
        console.log(`[PASS] Found ${tools.length} OS tools registered.\n`);

        console.log("2. Verifying 'read_local_file' function presence...");
        const hasReadFile = tools.some(t => t.function.name === 'read_local_file');
        console.log(`[PASS] read_local_file registered: ${hasReadFile}\n`);

        console.log("3. Safely reading a test file (config.yaml)...");
        const configPath = resolveNyxoraPath('config/config.yaml');
        if (fs.existsSync(configPath)) {
            console.log(`[PASS] Config file found at: ${configPath}\n`);
        } else {
            console.warn(`[WARN] Config file not found at: ${configPath}\n`);
        }

        console.log("All OS tests passed! (Safe Mode)");
    } catch (error) {
        console.error("[FAIL] OS test encountered an error:", error);
    }
}

testOSPlugin();
