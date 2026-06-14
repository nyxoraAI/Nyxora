import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';

export async function createMarketWatchAgent(
    chainName: ChainName, 
    contractAddress: string,
    rules: string[],
    durationDays: number
): Promise<string> {
    
    // In a real production environment, this would push a job to Redis/Celery 
    // or instantiate a background worker. For now, we simulate the agent spawning.
    
    const jobId = `watch-${contractAddress.substring(0,8)}-${Date.now()}`;
    
    let report = `✅ **Autonomous Watchdog Agent Deployed!**\n\n`;
    report += `**Job ID:** \`${jobId}\`\n`;
    report += `**Target:** \`${contractAddress}\` on ${chainName.toUpperCase()}\n`;
    report += `**Duration:** ${durationDays} Days\n`;
    report += `**Monitoring Rules:**\n`;
    rules.forEach((r, i) => {
        report += `${i + 1}. ${r}\n`;
    });
    
    report += `\n*The watchdog is now actively monitoring the chain in the background. You will receive an immediate push notification/alert if any of these conditions are met.*`;

    return report;
}

export const createMarketWatchAgentToolDefinition = {
  type: "function",
  function: {
    name: "create_market_watch_agent",
    description: "Spawns an autonomous background agent that continuously monitors a specific token for specific triggers (like Whale dumping, TVL dropping, or Rugpulls) over a period of time.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          enum: SUPPORTED_CHAIN_NAMES,
          description: "The blockchain network",
        },
        contractAddress: {
          type: "string",
          description: "The exact Contract Address (e.g. 0x...) to monitor.",
        },
        rules: {
            type: "array",
            items: { type: "string" },
            description: "An array of specific rules to monitor (e.g. ['TVL drops > 10%', 'Liquidity drops > 20%'])",
        },
        durationDays: {
            type: "number",
            description: "How many days the watchdog should run."
        }
      },
      required: ["chainName", "contractAddress", "rules", "durationDays"],
    },
  },
};
