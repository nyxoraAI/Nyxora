const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token');
const JWT_SECRET = fs.readFileSync(tokenPath, 'utf8').trim();

const internalToken = jwt.sign({ service: 'test' }, JWT_SECRET, { expiresIn: '1m' });

const payload = {
  type: 'transfer',
  chainName: 'base',
  details: {
    amountWei: '1000000000000000000', // 1 ETH
    estimatedUsdValue: 3000,
    to: '0x1234567890123456789012345678901234567890'
  }
};

const internalSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload.chainName + payload.details.amountWei).digest('hex');
payload.internalSignature = internalSignature;

fetch('http://127.0.0.1:3001/request-tx', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${internalToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => {
  console.log('--- TEST /request-tx ---');
  console.log(JSON.stringify(data, null, 2));
  
  return fetch('http://127.0.0.1:3001/pending-tx', {
    headers: { 'Authorization': `Bearer ${internalToken}` }
  });
})
.then(res => res.json())
.then(data => {
  console.log('--- TEST /pending-tx ---');
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
