const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const yaml = require('yaml');

const config = yaml.parse(fs.readFileSync('/home/perasyudha/.nyxora/config/trading.yaml', 'utf8'));
const key = config.exchanges.binance.api_key;
const secret = config.exchanges.binance.api_secret;

const baseUrl = 'https://testnet.binancefuture.com';
const path = '/fapi/v2/positionRisk';
const timestamp = Date.now();
const query = `recvWindow=5000&timestamp=${timestamp}`;
const signature = crypto.createHmac('sha256', secret).update(query).digest('hex');

const fullUrl = `${baseUrl}${path}?${query}&signature=${signature}`;

https.get(fullUrl, { headers: { 'X-MBX-APIKEY': key } }, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const positions = JSON.parse(data);
      const active = positions.filter(p => Number(p.positionAmt) !== 0);
      console.log(JSON.stringify(active, null, 2));
    } catch(e) {
      console.error(e);
    }
  });
}).on('error', (e) => console.error(e));
