import { getPublicClient } from './src/web3/utils/rpcEngine';

async function testChain(chainName) {
  try {
    const client = getPublicClient(chainName);
    const blockNumber = await client.getBlockNumber();
    console.log(`${chainName} block number: ${blockNumber}`);
    
    // test multicall
    const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
    const MULTICALL3_ABI = [{
      inputs: [{ name: 'addr', type: 'address' }],
      name: 'getEthBalance',
      outputs: [{ name: 'balance', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    }];
    
    const res = await client.multicall({
      contracts: [{
        address: MULTICALL3_ADDRESS,
        abi: MULTICALL3_ABI,
        functionName: 'getEthBalance',
        args: ['0x0000000000000000000000000000000000000000']
      }],
      allowFailure: true
    });
    console.log(`${chainName} multicall result:`, res);
  } catch (e) {
    console.error(`Error on ${chainName}:`, e.message);
  }
}

(async () => {
  await testChain('robinhood');
  await testChain('robinhood_testnet');
})();
