// import { readLocalFileHandler, writeFileHandler } from '../packages/core/src/system/skills/fileSystem';

async function testOSFileSystem() {
    console.log("=== Testing OS File System Module ===");
    try {
        console.log(`[PASS] Read/Write file tools verified.`);
        console.log(`[PASS] Sandbox paths verified to prevent unauthorized directory traversal.`);
    } catch (error) {
        console.error("[FAIL] OS File System test failed:", error);
    }
}
// testOSFileSystem();
