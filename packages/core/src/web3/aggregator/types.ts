export type ProviderNetwork = 'mainnet' | 'testnet';

export interface ProviderHealth {
  ok: boolean;
  latencyMs?: number;
  reason?: string;
  checkedAt: number;
}

export interface ApiKeyRequirement {
  id: string;
  label: string;
  envKey: string;
  required: boolean;
  secret: boolean;
  docsUrl?: string;
}

export interface ProviderManifest {
  id: string;
  name: string;
  version: string;

  networks: ProviderNetwork[];
  capabilities: Array<'swap' | 'bridge' | 'cross_chain_swap'>;

  requiredApiKeys?: ApiKeyRequirement[];

  allowedDomains: string[];
  permissions: {
    network: boolean;
    walletAccess: 'none' | 'read' | 'sign';
    filesystem: 'none' | 'read' | 'write';
  };
}

export interface QuoteRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amountInWei: string;
  amountFormatted?: string;
  userAddress: string;
  slippageTolerance: number | "auto";
  preferredProvider?: string;
}

export interface ProviderExecutionContext {
  requestId: string;
  abortSignal: AbortSignal;
  apiKeys: Record<string, string>;
}

export interface CanonicalRouteQuote {
  provider: string;
  routeId: string;

  fromChainId: number;
  toChainId: number;

  inputAmount: bigint;
  outputAmount: bigint;

  estimatedGasUsd?: number;
  protocolFeeUsd?: number;
  bridgeFeeUsd?: number;
  totalFeeUsd?: number;

  priceImpactBps?: number;
  estimatedTimeSeconds?: number;

  expiresAt: number;
  executable: boolean;
  approvalAddress?: string;

  execution: {
    target: string;
    calldata: string;
    value: bigint;
  };

  raw?: unknown;
}

export interface DefiAggregatorProvider {
  readonly manifest: ProviderManifest;

  isCrossChainSupported(): boolean;

  supports(request: QuoteRequest): boolean;

  getQuote(
    request: QuoteRequest,
    context: ProviderExecutionContext
  ): Promise<CanonicalRouteQuote>;

  isHealthy(
    context: ProviderExecutionContext
  ): Promise<ProviderHealth>;
}
