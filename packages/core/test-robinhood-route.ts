import { fetchBestRoute } from './src/web3/aggregator/routeSelector';
import { ArbitrumBridgeProvider } from './src/web3/aggregator/providers/ArbitrumBridgeProvider';
import { RelayProvider } from './src/web3/aggregator/providers/RelayProvider';
import { QuoteRequest } from './src/web3/aggregator/types';
import crypto from 'crypto';

async function testMainnet() {
  console.log("=== Testing Robinhood Mainnet Route (Relay) ===");
  const provider = new RelayProvider();
  const request: QuoteRequest = {
    fromChain: 'arbitrum',
    toChain: 'robinhood',
    fromToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    toToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    amountInWei: '1000000000000000', // 0.001 ETH
    userAddress: '0x1234567890123456789012345678901234567890',
    slippageTolerance: 0.5
  };
  
  if (provider.supports(request)) {
    console.log("Relay supports Arbitrum -> Robinhood");
    try {
      const quote = await provider.getQuote(request, { requestId: '1', abortSignal: new AbortController().signal, apiKeys: {} });
      console.log("Success! Route ID:", quote.routeId, "Output:", quote.outputAmount.toString());
    } catch (e: any) {
      console.log("Failed to get quote (maybe API error or liquidity):", e.message);
    }
  } else {
    console.log("Relay says it DOES NOT support this route.");
  }
}

async function testTestnet() {
  console.log("\n=== Testing Robinhood Testnet Route (Arbitrum Bridge) ===");
  const provider = new ArbitrumBridgeProvider();
  const request: QuoteRequest = {
    fromChain: 'sepolia',
    toChain: 'robinhood_testnet',
    fromToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    toToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    amountInWei: '1000000000000000', // 0.001 ETH
    userAddress: '0x1234567890123456789012345678901234567890',
    slippageTolerance: 0.5
  };
  
  if (provider.supports(request)) {
    console.log("ArbitrumBridge supports Sepolia -> Robinhood Testnet");
    try {
      const quote = await provider.getQuote(request, { requestId: '2', abortSignal: new AbortController().signal, apiKeys: {} });
      console.log("Success! Execution Target:", quote.execution.target);
    } catch (e: any) {
      console.log("Error:", e.message);
    }
  } else {
    console.log("ArbitrumBridge says it DOES NOT support this route.");
  }
}

async function run() {
  await testMainnet();
  await testTestnet();
}

run();
