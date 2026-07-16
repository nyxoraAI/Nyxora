const { createPublicClient, http } = require('viem');
const { sepolia } = require('viem/chains');

async function test() {
  console.log("Starting test...");
  try {
    const client = createPublicClient({ chain: sepolia, transport: http() });
    const feeData = await client.estimateFeesPerGas();
    console.log("Success:", feeData);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
