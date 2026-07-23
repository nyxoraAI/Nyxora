const { createPublicClient, http } = require('viem');
const { robinhoodTestnet } = require('./packages/core/dist/web3/utils/chains.js'); // adjust path if needed

const client = createPublicClient({
  chain: robinhoodTestnet,
  transport: http('https://rpc.testnet.chain.robinhood.com')
});

async function run() {
  const address = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const code = await client.getBytecode({ address });
  console.log("Multicall3 code:", code ? "Deployed" : "Not Deployed");
}

run().catch(console.error);
