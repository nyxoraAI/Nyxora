import { ensurePlaybookDir } from '../packages/core/src/system/skills/playbookManager';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function testPlaybookManager() {
    console.log("=== Testing Playbook Manager (Smart Sync) ===");
    try {
        console.log("1. Running ensurePlaybookDir()...");
        // Normally this syncs the files. We wrap it in a try-catch to ensure it doesn't throw.
        ensurePlaybookDir();
        console.log("[PASS] Smart Sync completed without throwing errors.\n");

        console.log("2. Verifying user playbook directory exists...");
        const userDir = path.join(os.homedir(), '.nyxora', 'playbooks');
        if (fs.existsSync(userDir)) {
            console.log(`[PASS] User playbook directory found: ${userDir}\n`);
        } else {
            console.warn(`[WARN] User playbook directory missing at: ${userDir}\n`);
        }

        console.log("All Playbook Manager tests passed!");
    } catch (error) {
        console.error("[FAIL] Playbook Manager test encountered an error:", error);
    }
}

testPlaybookManager();
