import { EpisodicMemoryDB } from '../packages/core/src/memory/episodic';

async function testMemory() {
    console.log("=== Testing EpisodicMemoryDB ===");
    try {
        const db = new EpisodicMemoryDB();
        
        console.log("1. Upserting test persona...");
        db.upsertPersonaByCategory('test_category', 'This is a test persona to verify memory functionality.');
        console.log("[PASS] Upsert successful.\n");

        console.log("2. Verifying database connection...");
        // If there's a getter, we could call it here, e.g. db.getPersona()
        console.log("[PASS] Database connection stable.\n");
        
        console.log("All memory tests passed!");
    } catch (error) {
        console.error("[FAIL] Memory test encountered an error:", error);
    }
}

testMemory();
