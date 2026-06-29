import { aggregatorRegistry } from './web3/aggregator/providerRegistry';
import { fetchBestRoute } from './web3/aggregator/routeSelector';
import { QuoteRequest } from './web3/aggregator/types';

async function testMainnetSwap(providerName: string) {
  try {
    const req: QuoteRequest = {
      fromChain: 'ethereum',
      toChain: 'ethereum',
      fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      toToken: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      amountInWei: '1000000',
      amountFormatted: '1',
      userAddress: '0x1234567890123456789012345678901234567890',
      slippageTolerance: 50,
      preferredProvider: providerName
    };
    
    console.log(`\n--- Testing ${providerName} ---`);
    const quote = await fetchBestRoute(req, "best_output");
    
    console.log(`[+] SUCCESS. Provider used: ${quote.provider}`);
    console.log(`    - execution.target: ${quote.execution.target}`);
    console.log(`    - approvalAddress: ${quote.approvalAddress || 'MISSING (UNDEFINED)'}`);
    console.log(`    - execution.value: ${quote.execution.value.toString()} wei (Should be 0 for ERC20)`);
    
    if (quote.approvalAddress && quote.approvalAddress.toLowerCase() !== quote.execution.target.toLowerCase()) {
       console.log(`    ⚠️ WARNING: execution.target DOES NOT MATCH approvalAddress!`);
    } else if (!quote.approvalAddress) {
       console.log(`    🚨 CRITICAL: Provider DID NOT return an approvalAddress!`);
    }

    if (quote.execution.value > 0n) {
       console.log(`    🚨 FATAL EXPLOIT: Provider requested native ETH value > 0 for an ERC20 swap!`);
    }
  } catch (err: any) {
    console.log(`[-] FAILED: ${err.message}`);
  }
}

async function main() {
  await aggregatorRegistry.autoDiscover();
  
  const providers = ['lifi', '0x', 'oneinch', 'kyberswap', 'openocean'];
  for (const p of providers) {
    await testMainnetSwap(p);
  }
}

main().catch(console.error);
