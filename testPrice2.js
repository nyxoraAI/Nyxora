const { loadConfig } = require('./packages/core/dist/config/parser.js');
const { getPrice } = require('./packages/core/dist/web3/skills/getPrice.js');

getPrice('0x22f7Cb13D44e6Da722D92D137A7635d05b206A96', 'idr', 3821)
  .then(console.log)
  .catch(console.error);
