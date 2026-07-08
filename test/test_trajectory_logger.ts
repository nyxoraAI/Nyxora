import { TrajectoryLogger } from '../packages/core/src/utils/trajectoryLogger';

async function testTrajectoryLogger() {
    console.log("=== Testing Trajectory Logger ===");
    try {
        const logger = new TrajectoryLogger();
        const sessionId = 'test-session-123';
        
        logger.addEntry({ role: 'user', content: 'hello test' }, sessionId);
        const history = logger.getHistory(sessionId);
        
        console.log(`[PASS] Logged 1 entry. History length: ${history.length}`);
        if (history.length > 0 && history[0].content === 'hello test') {
            console.log(`[PASS] Entry content is intact.`);
        }
    } catch (error) {
        console.error("[FAIL] Trajectory Logger test failed:", error);
    }
}
// testTrajectoryLogger();
