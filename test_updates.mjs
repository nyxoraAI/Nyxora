import fs from 'fs';
import path from 'path';
import os from 'os';

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE TESTS ---\n');
  
  const tokenFile = path.join(os.homedir(), '.nyxora/auth/auth.token');
  let rawToken = fs.readFileSync(tokenFile, 'utf8').trim();
  let tokenState = JSON.parse(rawToken);
  let currentToken = tokenState.token;
  
  // 1. Test Replay Protection
  console.log('[TEST 1] Replay Protection (Nonce System)');
  try {
    const fetch = (await import('node-fetch')).default;
    const resNoNonce = await fetch('http://localhost:3000/api/transactions/fake_id/approve', {
      method: 'POST',
      headers: { 'x-nyxora-token': currentToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const dataNoNonce = await resNoNonce.json();
    console.log('  Result without nonce:', resNoNonce.status, dataNoNonce);
  } catch (e) {
    console.error('  Error:', e.message);
  }

  // 2. Test Token TTL & Grace Period
  console.log('\n[TEST 2] Token 7-Day TTL & Rotation');
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Simulate 8 days old token
    const oldState = { ...tokenState, createdAt: Date.now() - (8 * 24 * 60 * 60 * 1000) };
    fs.writeFileSync(tokenFile, JSON.stringify(oldState));
    
    // Restart daemon so it loads the old file
    console.log('  Restarting daemon to load modified token...');
    const { execSync } = await import('child_process');
    execSync('node bin/nyxora.mjs restart', { stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 3000)); // wait for daemon to start
    
    // Make an API call which should trigger rotation
    const resTrigger = await fetch('http://localhost:3000/api/status/lock', {
      method: 'GET',
      headers: { 'x-nyxora-token': currentToken }
    });
    
    const renewedHeader = resTrigger.headers.get('x-nyxora-renewed-token');
    console.log('  Trigger Request Status:', resTrigger.status);
    console.log('  Renewed Token Header injected:', renewedHeader ? 'YES' : 'NO');
    
    // Check if file is updated with new token
    const newRaw = fs.readFileSync(tokenFile, 'utf8').trim();
    const newState = JSON.parse(newRaw);
    console.log('  New token generated:', newState.token !== currentToken);
    console.log('  Previous token saved:', newState.previousToken === currentToken);
    
    // Make sure old token still works (grace period)
    const resGrace = await fetch('http://localhost:3000/api/status/lock', {
      method: 'GET',
      headers: { 'x-nyxora-token': currentToken }
    });
    const graceHeader = resGrace.headers.get('x-nyxora-renewed-token');
    console.log('  Grace Period Request Status:', resGrace.status, '(Using old token)');
    console.log('  Grace Period Response Header injected:', graceHeader ? 'YES' : 'NO');
    
    // Restore state
    fs.writeFileSync(tokenFile, newRaw); // keep the new one

  } catch (e) {
    console.error('  Error:', e.message);
  }
}

runTests();
