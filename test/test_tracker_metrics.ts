import { Tracker } from '../packages/core/src/utils/tracker';

async function testTrackerMetrics() {
    console.log("=== Testing Tracker Metrics ===");
    try {
        Tracker.addTokens(150, '9router');
        Tracker.addMessage();
        Tracker.addEvent('test_event', { value: 1 });
        
        console.log(`[PASS] Metrics recorded successfully (In-memory).`);
    } catch (error) {
        console.error("[FAIL] Tracker Metrics test failed:", error);
    }
}
// testTrackerMetrics();
