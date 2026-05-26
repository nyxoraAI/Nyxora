import { PublicClient, WalletClient } from 'viem';
export declare const supportedChains: {
    ethereum: {
        blockExplorers: {
            readonly default: {
                readonly name: "Etherscan";
                readonly url: "https://etherscan.io";
                readonly apiUrl: "https://api.etherscan.io/api";
            };
        };
        blockTime: 12000;
        contracts: {
            readonly ensUniversalResolver: {
                readonly address: "0xeeeeeeee14d718c2b47d9923deab1335e144eeee";
                readonly blockCreated: 23085558;
            };
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 14353601;
            };
        };
        ensTlds?: readonly string[] | undefined;
        id: 1;
        name: "Ethereum";
        nativeCurrency: {
            readonly name: "Ether";
            readonly symbol: "ETH";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://eth.merkle.io"];
            };
        };
        sourceId?: number | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: import("viem").ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
        verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
    };
    base: {
        blockExplorers: {
            readonly default: {
                readonly name: "Basescan";
                readonly url: "https://basescan.org";
                readonly apiUrl: "https://api.basescan.org/api";
            };
        };
        blockTime: 2000;
        contracts: {
            readonly disputeGameFactory: {
                readonly 1: {
                    readonly address: "0x43edB88C4B80fDD2AdFF2412A7BebF9dF42cB40e";
                };
            };
            readonly l2OutputOracle: {
                readonly 1: {
                    readonly address: "0x56315b90c40730925ec5485cf004d835058518A0";
                };
            };
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 5022;
            };
            readonly portal: {
                readonly 1: {
                    readonly address: "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e";
                    readonly blockCreated: 17482143;
                };
            };
            readonly l1StandardBridge: {
                readonly 1: {
                    readonly address: "0x3154Cf16ccdb4C6d922629664174b904d80F2C35";
                    readonly blockCreated: 17482143;
                };
            };
            readonly gasPriceOracle: {
                readonly address: "0x420000000000000000000000000000000000000F";
            };
            readonly l1Block: {
                readonly address: "0x4200000000000000000000000000000000000015";
            };
            readonly l2CrossDomainMessenger: {
                readonly address: "0x4200000000000000000000000000000000000007";
            };
            readonly l2Erc721Bridge: {
                readonly address: "0x4200000000000000000000000000000000000014";
            };
            readonly l2StandardBridge: {
                readonly address: "0x4200000000000000000000000000000000000010";
            };
            readonly l2ToL1MessagePasser: {
                readonly address: "0x4200000000000000000000000000000000000016";
            };
        };
        ensTlds?: readonly string[] | undefined;
        id: 8453;
        name: "Base";
        nativeCurrency: {
            readonly name: "Ether";
            readonly symbol: "ETH";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://mainnet.base.org"];
            };
        };
        sourceId: 1;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: import("viem").ChainFees<undefined> | undefined;
        formatters: {
            readonly block: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcBlock, action?: string | undefined) => {
                    baseFeePerGas: bigint | null;
                    blobGasUsed: bigint;
                    difficulty: bigint;
                    excessBlobGas: bigint;
                    extraData: import("viem").Hex;
                    gasLimit: bigint;
                    gasUsed: bigint;
                    hash: `0x${string}` | null;
                    logsBloom: `0x${string}` | null;
                    miner: import("viem").Address;
                    mixHash: import("viem").Hash;
                    nonce: `0x${string}` | null;
                    number: bigint | null;
                    parentBeaconBlockRoot?: `0x${string}` | undefined;
                    parentHash: import("viem").Hash;
                    receiptsRoot: import("viem").Hex;
                    sealFields: import("viem").Hex[];
                    sha3Uncles: import("viem").Hash;
                    size: bigint;
                    stateRoot: import("viem").Hash;
                    timestamp: bigint;
                    totalDifficulty: bigint | null;
                    transactions: `0x${string}`[] | import("viem/chains").OpStackTransaction<boolean>[];
                    transactionsRoot: import("viem").Hash;
                    uncles: import("viem").Hash[];
                    withdrawals?: import("viem").Withdrawal[] | undefined | undefined;
                    withdrawalsRoot?: `0x${string}` | undefined;
                } & {};
                type: "block";
            };
            readonly transaction: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcTransaction, action?: string | undefined) => ({
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: boolean;
                    mint?: bigint | undefined | undefined;
                    sourceHash: import("viem").Hex;
                    type: "deposit";
                } | {
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    v: bigint;
                    to: import("viem").Address | null;
                    from: import("viem").Address;
                    gas: bigint;
                    nonce: number;
                    value: bigint;
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    accessList?: undefined | undefined;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId?: number | undefined;
                    yParity?: undefined | undefined;
                    type: "legacy";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas?: undefined | undefined;
                    maxPriorityFeePerGas?: undefined | undefined;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip2930";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas?: undefined | undefined;
                    maxPriorityFeePerGas?: undefined | undefined;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip1559";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes: readonly import("viem").Hex[];
                    chainId: number;
                    type: "eip4844";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas: bigint;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList: import("viem").SignedAuthorizationList;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip7702";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                }) & {};
                type: "transaction";
            };
            readonly transactionReceipt: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcTransactionReceipt, action?: string | undefined) => {
                    blobGasPrice?: bigint | undefined;
                    blobGasUsed?: bigint | undefined;
                    blockHash: import("viem").Hash;
                    blockNumber: bigint;
                    blockTimestamp?: bigint | undefined;
                    contractAddress: import("viem").Address | null | undefined;
                    cumulativeGasUsed: bigint;
                    effectiveGasPrice: bigint;
                    from: import("viem").Address;
                    gasUsed: bigint;
                    logs: import("viem").Log<bigint, number, false>[];
                    logsBloom: import("viem").Hex;
                    root?: `0x${string}` | undefined;
                    status: "success" | "reverted";
                    to: import("viem").Address | null;
                    transactionHash: import("viem").Hash;
                    transactionIndex: number;
                    type: import("viem").TransactionType;
                    l1GasPrice: bigint | null;
                    l1GasUsed: bigint | null;
                    l1Fee: bigint | null;
                    l1FeeScalar: number | null;
                } & {};
                type: "transactionReceipt";
            };
        };
        prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers: {
            readonly transaction: typeof import("viem/chains").serializeTransactionOpStack;
        };
        verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
    };
    bsc: {
        blockExplorers: {
            readonly default: {
                readonly name: "BscScan";
                readonly url: "https://bscscan.com";
                readonly apiUrl: "https://api.bscscan.com/api";
            };
        };
        blockTime: 750;
        contracts: {
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 15921452;
            };
        };
        ensTlds?: readonly string[] | undefined;
        id: 56;
        name: "BNB Smart Chain";
        nativeCurrency: {
            readonly decimals: 18;
            readonly name: "BNB";
            readonly symbol: "BNB";
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://56.rpc.thirdweb.com"];
            };
        };
        sourceId?: number | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: import("viem").ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
        verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
    };
    arbitrum: {
        blockExplorers: {
            readonly default: {
                readonly name: "Arbiscan";
                readonly url: "https://arbiscan.io";
                readonly apiUrl: "https://api.arbiscan.io/api";
            };
        };
        blockTime: 250;
        contracts: {
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 7654707;
            };
        };
        ensTlds?: readonly string[] | undefined;
        id: 42161;
        name: "Arbitrum One";
        nativeCurrency: {
            readonly name: "Ether";
            readonly symbol: "ETH";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://arb1.arbitrum.io/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: import("viem").ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
        verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
    };
    optimism: {
        blockExplorers: {
            readonly default: {
                readonly name: "Optimism Explorer";
                readonly url: "https://optimistic.etherscan.io";
                readonly apiUrl: "https://api-optimistic.etherscan.io/api";
            };
        };
        blockTime: 2000;
        contracts: {
            readonly disputeGameFactory: {
                readonly 1: {
                    readonly address: "0xe5965Ab5962eDc7477C8520243A95517CD252fA9";
                };
            };
            readonly l2OutputOracle: {
                readonly 1: {
                    readonly address: "0xdfe97868233d1aa22e815a266982f2cf17685a27";
                };
            };
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 4286263;
            };
            readonly portal: {
                readonly 1: {
                    readonly address: "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed";
                };
            };
            readonly l1StandardBridge: {
                readonly 1: {
                    readonly address: "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1";
                };
            };
            readonly gasPriceOracle: {
                readonly address: "0x420000000000000000000000000000000000000F";
            };
            readonly l1Block: {
                readonly address: "0x4200000000000000000000000000000000000015";
            };
            readonly l2CrossDomainMessenger: {
                readonly address: "0x4200000000000000000000000000000000000007";
            };
            readonly l2Erc721Bridge: {
                readonly address: "0x4200000000000000000000000000000000000014";
            };
            readonly l2StandardBridge: {
                readonly address: "0x4200000000000000000000000000000000000010";
            };
            readonly l2ToL1MessagePasser: {
                readonly address: "0x4200000000000000000000000000000000000016";
            };
        };
        ensTlds?: readonly string[] | undefined;
        id: 10;
        name: "OP Mainnet";
        nativeCurrency: {
            readonly name: "Ether";
            readonly symbol: "ETH";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://mainnet.optimism.io"];
            };
        };
        sourceId: 1;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: import("viem").ChainFees<undefined> | undefined;
        formatters: {
            readonly block: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcBlock, action?: string | undefined) => {
                    baseFeePerGas: bigint | null;
                    blobGasUsed: bigint;
                    difficulty: bigint;
                    excessBlobGas: bigint;
                    extraData: import("viem").Hex;
                    gasLimit: bigint;
                    gasUsed: bigint;
                    hash: `0x${string}` | null;
                    logsBloom: `0x${string}` | null;
                    miner: import("viem").Address;
                    mixHash: import("viem").Hash;
                    nonce: `0x${string}` | null;
                    number: bigint | null;
                    parentBeaconBlockRoot?: `0x${string}` | undefined;
                    parentHash: import("viem").Hash;
                    receiptsRoot: import("viem").Hex;
                    sealFields: import("viem").Hex[];
                    sha3Uncles: import("viem").Hash;
                    size: bigint;
                    stateRoot: import("viem").Hash;
                    timestamp: bigint;
                    totalDifficulty: bigint | null;
                    transactions: `0x${string}`[] | import("viem/chains").OpStackTransaction<boolean>[];
                    transactionsRoot: import("viem").Hash;
                    uncles: import("viem").Hash[];
                    withdrawals?: import("viem").Withdrawal[] | undefined | undefined;
                    withdrawalsRoot?: `0x${string}` | undefined;
                } & {};
                type: "block";
            };
            readonly transaction: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcTransaction, action?: string | undefined) => ({
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: boolean;
                    mint?: bigint | undefined | undefined;
                    sourceHash: import("viem").Hex;
                    type: "deposit";
                } | {
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    v: bigint;
                    to: import("viem").Address | null;
                    from: import("viem").Address;
                    gas: bigint;
                    nonce: number;
                    value: bigint;
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    accessList?: undefined | undefined;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId?: number | undefined;
                    yParity?: undefined | undefined;
                    type: "legacy";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas?: undefined | undefined;
                    maxPriorityFeePerGas?: undefined | undefined;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip2930";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas?: undefined | undefined;
                    maxPriorityFeePerGas?: undefined | undefined;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip1559";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList?: undefined | undefined;
                    blobVersionedHashes: readonly import("viem").Hex[];
                    chainId: number;
                    type: "eip4844";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas: bigint;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    blockTimestamp?: bigint | undefined;
                    from: import("viem").Address;
                    gas: bigint;
                    hash: import("viem").Hash;
                    input: import("viem").Hex;
                    nonce: number;
                    r: import("viem").Hex;
                    s: import("viem").Hex;
                    to: import("viem").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("viem").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("viem").AccessList;
                    authorizationList: import("viem").SignedAuthorizationList;
                    blobVersionedHashes?: undefined | undefined;
                    chainId: number;
                    type: "eip7702";
                    gasPrice?: undefined | undefined;
                    maxFeePerBlobGas?: undefined | undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined | undefined;
                    mint?: undefined | undefined;
                    sourceHash?: undefined | undefined;
                }) & {};
                type: "transaction";
            };
            readonly transactionReceipt: {
                exclude: [] | undefined;
                format: (args: import("viem/chains").OpStackRpcTransactionReceipt, action?: string | undefined) => {
                    blobGasPrice?: bigint | undefined;
                    blobGasUsed?: bigint | undefined;
                    blockHash: import("viem").Hash;
                    blockNumber: bigint;
                    blockTimestamp?: bigint | undefined;
                    contractAddress: import("viem").Address | null | undefined;
                    cumulativeGasUsed: bigint;
                    effectiveGasPrice: bigint;
                    from: import("viem").Address;
                    gasUsed: bigint;
                    logs: import("viem").Log<bigint, number, false>[];
                    logsBloom: import("viem").Hex;
                    root?: `0x${string}` | undefined;
                    status: "success" | "reverted";
                    to: import("viem").Address | null;
                    transactionHash: import("viem").Hash;
                    transactionIndex: number;
                    type: import("viem").TransactionType;
                    l1GasPrice: bigint | null;
                    l1GasUsed: bigint | null;
                    l1Fee: bigint | null;
                    l1FeeScalar: number | null;
                } & {};
                type: "transactionReceipt";
            };
        };
        prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers: {
            readonly transaction: typeof import("viem/chains").serializeTransactionOpStack;
        };
        verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
    };
};
export type ChainName = keyof typeof supportedChains;
export declare function getPublicClient(chainName: ChainName): PublicClient;
export declare function getWalletClient(chainName: ChainName): WalletClient;
export declare function getAddress(): `0x${string}`;
//# sourceMappingURL=config.d.ts.map