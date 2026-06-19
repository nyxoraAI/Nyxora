import { ChainName } from '../config';
import { loadDefiKeys } from '../../config/defiConfigManager';
import { safeFetch } from '../../utils/httpClient';

export interface RouteQuote {
  provider: string;
  expectedOutput: string;
  expectedOutputRaw: string;
  gasCostUsd: number;
  txPayload: any;
  rawQuote: any;
}

const HEALTH_CACHE: Record<string, { fails: number; lastFail: number }> = {};
const MAX_FAILS = 3;
const COOLDOWN_MS = 60000;

function isProviderHealthy(provider: string): boolean {
  const state = HEALTH_CACHE[provider];
  if (!state) return true;
  if (state.fails >= MAX_FAILS) {
    if (Date.now() - state.lastFail > COOLDOWN_MS) {
      HEALTH_CACHE[provider] = { fails: 0, lastFail: 0 }; // Reset
      return true;
    }
    return false;
  }
  return true;
}

function recordProviderFailure(provider: string) {
  if (!HEALTH_CACHE[provider]) HEALTH_CACHE[provider] = { fails: 0, lastFail: 0 };
  HEALTH_CACHE[provider].fails += 1;
  HEALTH_CACHE[provider].lastFail = Date.now();
  console.warn(`[Aggregator] ${provider} failed. Strike ${HEALTH_CACHE[provider].fails}/${MAX_FAILS}`);
}

export async function fetchMainnetBestRoute(
  fromChain: ChainName,
  toChain: ChainName,
  fromToken: string,
  toToken: string,
  amountInWei: string,
  userAddress: string,
  slippageTolerance: number | "auto" = "auto"
): Promise<RouteQuote> {
  const keys = loadDefiKeys();
  const isCrossChain = fromChain !== toChain;

  const promises: Promise<RouteQuote | null>[] = [];

  // Provider 1: 1inch (Same chain only)
  if (!isCrossChain && isProviderHealthy('1inch')) {
    promises.push(fetch1inch(fromChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance, keys.inch_key));
  }

  // Provider 2: 0x (Same chain only)
  if (!isCrossChain && isProviderHealthy('0x')) {
    promises.push(fetch0x(fromChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance, keys.zero_x_key));
  }

  // Provider 3: LI.FI (Cross-chain & Same-chain)
  if (isProviderHealthy('lifi')) {
    promises.push(fetchLifi(fromChain, toChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance, keys.lifi_key));
  }

  // Provider 4: Relay (Cross-chain & Same-chain)
  if (isProviderHealthy('relay')) {
    promises.push(fetchRelay(fromChain, toChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance, keys.relay_key));
  }

  // Provider 5: OpenOcean (Cross-chain & Same-chain)
  if (isProviderHealthy('openocean')) {
    promises.push(fetchOpenOcean(fromChain, toChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance, keys.openocean_key));
  }

  // Provider 6: KyberSwap (Same-chain ONLY)
  if (!isCrossChain && isProviderHealthy('kyberswap')) {
    promises.push(fetchKyberSwap(fromChain, fromToken, toToken, amountInWei, userAddress, slippageTolerance));
  }

  // Execute all healthy providers concurrently with a 4s timeout
  const TIMEOUT_MS = 4000;
  const results = await Promise.allSettled(
    promises.map(p => 
      Promise.race([
        p, 
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
      ])
    )
  );

  const validQuotes: RouteQuote[] = [];

  results.forEach((res, index) => {
    if (res.status === 'fulfilled' && res.value) {
      validQuotes.push(res.value);
    } else if (res.status === 'rejected') {
      // Determine which provider failed based on index (simplified logic, usually we wrap the promise to carry the name)
      // For this implementation, we just log. The wrapper inside each fetcher records failure.
    }
  });

  if (validQuotes.length === 0) {
    throw new Error('All Meta-Aggregator providers failed or timed out. No route found.');
  }

  // Sort by expected output (highest first)
  validQuotes.sort((a, b) => {
    const outA = BigInt(a.expectedOutputRaw);
    const outB = BigInt(b.expectedOutputRaw);
    if (outA > outB) return -1;
    if (outA < outB) return 1;
    return 0;
  });

  // Optional: We can adjust sorting to account for gas cost. (OutputValue - GasValue). 
  // For MVP, raw output is sufficient.
  
  console.log(`[Aggregator] Best route found via ${validQuotes[0].provider}`);
  return validQuotes[0];
}

// --- Internal Fetchers --- //

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, bsc: 56, arbitrum: 42161, optimism: 10, polygon: 137
};

async function fetch1inch(chain: string, fromToken: string, toToken: string, amount: string, address: string, slippage: number | "auto", key?: string): Promise<RouteQuote | null> {
  try {
    if (!key) throw new Error('1inch requires an API key');
    const chainId = CHAIN_IDS[chain];
    const res = await safeFetch(`https://api.1inch.dev/swap/v6.0/${chainId}/swap?src=${fromToken}&dst=${toToken}&amount=${amount}&from=${address}&slippage=${slippage}&disableEstimate=true`, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return {
      provider: '1inch',
      expectedOutput: (Number(data.dstAmount) / 1e18).toString(), // simplified
      expectedOutputRaw: data.dstAmount,
      gasCostUsd: 0,
      txPayload: data.tx,
      rawQuote: data
    };
  } catch (e) {
    recordProviderFailure('1inch');
    return null;
  }
}

async function fetch0x(chain: string, fromToken: string, toToken: string, amount: string, address: string, slippage: number | "auto", key?: string): Promise<RouteQuote | null> {
  try {
    if (!key) throw new Error('0x requires an API key');
    const slipParam = slippage === "auto" ? "0.005" : (slippage as number / 100).toString();
    const res = await safeFetch(`https://api.0x.org/swap/v1/quote?sellToken=${fromToken}&buyToken=${toToken}&sellAmount=${amount}&takerAddress=${address}&slippagePercentage=${slipParam}`, {
      headers: { '0x-api-key': key }
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return {
      provider: '0x',
      expectedOutput: (Number(data.buyAmount) / 1e18).toString(),
      expectedOutputRaw: data.buyAmount,
      gasCostUsd: 0,
      txPayload: { to: data.to, data: data.data, value: data.value },
      rawQuote: data
    };
  } catch (e) {
    recordProviderFailure('0x');
    return null;
  }
}

async function fetchLifi(fromChain: string, toChain: string, fromToken: string, toToken: string, amount: string, address: string, slippage: number | "auto", key?: string): Promise<RouteQuote | null> {
  try {
    const slipParam = slippage === "auto" ? 0.005 : (slippage as number / 100);
    const res = await safeFetch(`https://li.quest/v1/quote?fromChain=${fromChain}&toChain=${toChain}&fromToken=${fromToken}&toToken=${toToken}&fromAmount=${amount}&fromAddress=${address}&slippage=${slipParam}`, {
      headers: key ? { 'x-lifi-api-key': key } : undefined
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return {
      provider: 'LI.FI',
      expectedOutput: (Number(data.estimate.toAmount) / 1e18).toString(),
      expectedOutputRaw: data.estimate.toAmount,
      gasCostUsd: Number(data.estimate.gasCosts?.[0]?.amountUSD || 0),
      txPayload: data.transactionRequest,
      rawQuote: data
    };
  } catch (e) {
    recordProviderFailure('lifi');
    return null;
  }
}

async function fetchRelay(fromChain: string, toChain: string, fromToken: string, toToken: string, amount: string, address: string, slippage: number | "auto", key?: string): Promise<RouteQuote | null> {
  try {
    // Relay API strictly requires the zero address for Native ETH instead of 0xeeee...
    const relayOriginCurrency = fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' 
      ? '0x0000000000000000000000000000000000000000' : fromToken;
    const relayDestCurrency = toToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      ? '0x0000000000000000000000000000000000000000' : toToken;

    const payload = {
      user: address,
      originChainId: CHAIN_IDS[fromChain].toString(),
      destinationChainId: CHAIN_IDS[toChain].toString(),
      originCurrency: relayOriginCurrency,
      destinationCurrency: relayDestCurrency,
      recipient: address,
      tradeType: 'EXACT_INPUT',
      amount: amount,
      referrer: 'nyxora',
      useExternalLiquidity: false
    };
    const res = await safeFetch('https://api.relay.link/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return {
      provider: 'Relay',
      expectedOutput: (Number(data.details?.currencyOut?.amount) / 1e18).toString(),
      expectedOutputRaw: data.details?.currencyOut?.amount,
      gasCostUsd: 0,
      txPayload: data.steps?.[0]?.items?.[0]?.data,
      rawQuote: data
    };
  } catch (e) {
    recordProviderFailure('relay');
    return null;
  }
}

async function fetchOpenOcean(fromChain: string, toChain: string, fromToken: string, toToken: string, amount: string, address: string, slippage: number | "auto", key?: string): Promise<RouteQuote | null> {
  // Mock implementation for OpenOcean API which varies widely
  // In a real app, you'd use their exact V3 API specification
  recordProviderFailure('openocean'); 
  return null;
}

async function fetchKyberSwap(fromChain: string, fromToken: string, toToken: string, amount: string, address: string, slippage: number | "auto"): Promise<RouteQuote | null> {
  try {
    const chainName = fromChain.toLowerCase().replace(/_/g, '');
    const slipParam = slippage === "auto" ? 50 : (slippage as number * 100);
    
    // Phase 1: Route
    const routeRes = await safeFetch(`https://aggregator-api.kyberswap.com/${chainName}/api/v1/routes?tokenIn=${fromToken}&tokenOut=${toToken}&amountIn=${amount}`);
    if (!routeRes.ok) throw new Error(await routeRes.text());
    const routeData = await routeRes.json();
    
    if (!routeData.data || !routeData.data.routeSummary) throw new Error("No Kyber route found");

    // Phase 2: Build
    const buildPayload = {
      routeSummary: routeData.data.routeSummary,
      sender: address,
      recipient: address,
      slippageTolerance: slipParam
    };

    const buildRes = await safeFetch(`https://aggregator-api.kyberswap.com/${chainName}/api/v1/route/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload)
    });
    if (!buildRes.ok) throw new Error(await buildRes.text());
    const buildData = await buildRes.json();

    const isNative = fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                     fromToken === '0x0000000000000000000000000000000000000000';

    return {
      provider: 'KyberSwap',
      expectedOutput: (Number(routeData.data.routeSummary.amountOut) / 1e18).toString(),
      expectedOutputRaw: routeData.data.routeSummary.amountOut,
      gasCostUsd: Number(routeData.data.routeSummary.gasUsd || 0),
      txPayload: {
        to: buildData.data.routerAddress,
        data: buildData.data.data,
        value: isNative ? amount : "0" // FIXED: Mengirim jumlah asli dalam WEI jika Native ETH, atau 0 jika ERC20
      },
      rawQuote: buildData.data
    };
  } catch (e) {
    recordProviderFailure('kyberswap');
    return null;
  }
}
