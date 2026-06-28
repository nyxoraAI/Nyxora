import { Plugin } from '../../plugin/types';
import { checkSecurityToolDefinition, checkTokenSecurity } from '../skills/checkSecurity';
import { getTrendingTokensToolDefinition, getTrendingTokens } from '../skills/getTrendingTokens';
import { createMarketWatchAgentToolDefinition, createMarketWatchAgent } from '../skills/createMarketWatchAgent';
import { checkRegistryStatusToolDefinition, checkRegistryStatus } from '../skills/checkRegistryStatus';

export class Web3SecurityPlugin implements Plugin {
  public name = 'Web3SecurityPlugin';
  public description = 'Security, analysis, and safety registry operations.';
  public version = '1.0.0';

  public tools = [
    checkSecurityToolDefinition,
    getTrendingTokensToolDefinition,
    createMarketWatchAgentToolDefinition,
    checkRegistryStatusToolDefinition
  ];

  public handlers = {
    ['check_token_security']: async (args: any) => {
      return await checkTokenSecurity(args.chainName, args.contractAddress);
    },
    ['get_trending_tokens']: async (args: any) => {
      return await getTrendingTokens(args.chainName, 5);
    },
    ['create_market_watch_agent']: async (args: any) => {
      return await createMarketWatchAgent(args.chainName, args.contractAddress, args.rules, args.durationDays);
    },
    ['check_registry_status']: async (args: any) => {
      const registryResult = await checkRegistryStatus();
      return JSON.stringify(registryResult);
    }
  };
}
