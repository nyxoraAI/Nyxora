import { PublicClient } from 'viem';
import { ChainName } from './chains';
export declare function getPublicClient(chainName: ChainName): PublicClient;
export declare function getWsClient(chainName: ChainName): PublicClient;
