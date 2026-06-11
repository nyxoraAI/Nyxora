import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

function getInternalToken(): string | undefined {
  try {
    const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf8').trim();
    }
  } catch (e) {}
  return undefined;
}

export async function getAddress(): Promise<string> {
  const token = getInternalToken();
  try {
    const res = await fetch(`http://127.0.0.1:${process.env.POLICY_PORT || 3001}/address`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.address;
  } catch (error: any) {
    throw new Error(`Failed to get address from vault: ${error.message}`);
  }
}

export async function submitTransaction(txPayload: any): Promise<string> {
  const token = getInternalToken();
  if (txPayload.autoApprove) {
    txPayload.details = txPayload.details || {};
    // ROOT FIX: Paksa amountWei selalu ada di payload agar Policy Engine tidak salah baca
    txPayload.details.amountWei = txPayload.details.amountWei || txPayload.details.valueWei || "0";
    
    const amountWei = txPayload.details.amountWei;
    const secret = getInternalToken() || '';
    txPayload.internalSignature = crypto.createHmac('sha256', secret).update(txPayload.chainName + amountWei).digest('hex');
  }
  try {
    const res = await fetch(`http://127.0.0.1:${process.env.POLICY_PORT || 3001}/request-tx`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(txPayload),
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit transaction');
    
    if (data.status === 'pending') {
      return `Pending (ID: ${data.txId})`;
    }
    return data.signedHash || data.hash || data.txHash || data.status || 'Transaction executed successfully (No Hash returned)';
  } catch (error: any) {
    throw new Error(`Transaction submission failed: ${error.message}`);
  }
}

