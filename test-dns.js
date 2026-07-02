const https = require('https');

const options = {
  hostname: '3.165.85.4',
  port: 443,
  path: '/api/v3/ping',
  method: 'GET',
  headers: {
    'Host': 'api.binance.com'
  },
  servername: 'api.binance.com'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('RESPONSE:', data));
});
req.on('error', console.error);
req.end();
