const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const yaml = require('yaml');

const config = yaml.parse(fs.readFileSync('/home/perasyudha/.nyxora/config/trading.yaml', 'utf8'));
const key = config.exchanges.binance.api_key;
const secret = config.exchanges.binance.api_secret;

function req(host, path) {
  return new Promise((resolve) => {
    const timestamp = Date.now();
    const query = `recvWindow=5000&timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(query).digest('hex');
    const url = `https://${host}${path}?${query}&signature=${signature}`;
    
    https.get(url, { headers: { 'X-MBX-APIKEY': key } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  console.log("Checking USDS-M Positions...");
  const p1 = await req('testnet.binancefuture.com', '/fapi/v2/positionRisk');
  if (Array.isArray(p1)) {
    const active = p1.filter(p => Number(p.positionAmt) !== 0);
    console.log("USDS-M Active:", active.length > 0 ? active : "None");
  } else { console.log(p1); }

  console.log("\nChecking COIN-M Positions...");
  const p2 = await req('dapi.binance.com', '/dapi/v1/positionRisk'); // testnet doesn't have coin-m api base easily available, let's just use mainnet or testnet.dapi
  // Wait, let's just check USDS-M Balance
  const b1 = await req('testnet.binancefuture.com', '/fapi/v2/balance');
  if (Array.isArray(b1)) {
    const activeB = b1.filter(b => Number(b.balance) > 0);
    console.log("USDS-M Balance:", activeB.length > 0 ? activeB : "None");
  }
}
run();
