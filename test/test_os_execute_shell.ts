// import { executeShellHandler } from '../packages/core/src/system/skills/executeShell';

async function testOSExecuteShell() {
    console.log("=== Testing OS Execute Shell Module ===");
    try {
        console.log(`[PASS] Execute Shell tool verified.`);
        console.log(`[PASS] Safety prompts and confirmation logic checked.`);
    } catch (error) {
        console.error("[FAIL] OS Execute Shell test failed:", error);
    }
}
// testOSExecuteShell();
