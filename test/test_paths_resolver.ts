import { getNyxoraDir, resolveNyxoraPath } from '../packages/core/src/config/paths';
import fs from 'fs';

async function testPathsResolver() {
    console.log("=== Testing Paths Resolver ===");
    try {
        const baseDir = getNyxoraDir();
        console.log(`[PASS] Base Nyxora Directory: ${baseDir}`);
        
        const configPath = resolveNyxoraPath('config/config.yaml');
        console.log(`[PASS] Resolved Config Path: ${configPath}`);
        console.log(`[PASS] File exists? ${fs.existsSync(configPath)}`);
    } catch (error) {
        console.error("[FAIL] Paths Resolver test failed:", error);
    }
}
// testPathsResolver();
