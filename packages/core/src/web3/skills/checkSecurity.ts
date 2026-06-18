import { ChainName, SUPPORTED_CHAIN_NAMES } from '../config';
import { safeFetchJson } from '../../utils/httpClient';

const CHAIN_IDS: Record<ChainName, number> = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  sepolia: 11155111,
  polygon: 137,
  base_sepolia: 84532,
  arbitrum_sepolia: 421614,
  optimism_sepolia: 11155420,
};

export async function checkTokenSecurity(chainName: ChainName, contractAddress: string): Promise<string> {
  try {
    const chainId = CHAIN_IDS[chainName];
    if (chainName === 'sepolia') {
      return `Security check API (GoPlus) does not support Sepolia testnet. Try a mainnet token.`;
    }

    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${contractAddress}`;
    const data = await safeFetchJson<any>(url);
    
    if (data.code !== 1 || !data.result) {
      throw new Error(`API returned error: ${data.message || 'Unknown error'}`);
    }

    const tokenData = data.result[contractAddress.toLowerCase()];
    if (!tokenData) {
      return `Token security data not found for ${contractAddress} on ${chainName}.`;
    }

    let report = `Security Analysis for ${tokenData.token_name || 'Unknown'} (${tokenData.token_symbol || 'Unknown'}):\n`;
    report += `- Is Honeypot: ${tokenData.is_honeypot === "1" ? "⚠️ YES (DANGER)" : "✅ NO"}\n`;
    report += `- Buy Tax: ${tokenData.buy_tax ? (parseFloat(tokenData.buy_tax) * 100).toFixed(2) + '%' : 'Unknown'}\n`;
    report += `- Sell Tax: ${tokenData.sell_tax ? (parseFloat(tokenData.sell_tax) * 100).toFixed(2) + '%' : 'Unknown'}\n`;
    report += `- Cannot Sell All: ${tokenData.cannot_sell_all === "1" ? "⚠️ YES" : "✅ NO"}\n`;
    report += `- Is Proxy Contract: ${tokenData.is_proxy === "1" ? "⚠️ YES (Can be upgraded)" : "✅ NO"}\n`;
    report += `- Owner Can Change Balance: ${tokenData.owner_change_balance === "1" ? "⚠️ YES" : "✅ NO"}\n`;
    report += `- Is Open Source: ${tokenData.is_open_source === "1" ? "✅ YES" : "⚠️ NO (Code is hidden)"}\n`;

    return report;
  } catch (error: any) {
    return `Failed to check token security: ${error.message}`;
  }
}

export const checkSecurityToolDefinition = {
  type: "function",
  function: {
    name: "check_token_security",
    description: "Check a token's smart contract for honeypot, rugpull risks, and buy/sell tax using GoPlus Security API.",
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
          description: "The token smart contract address (0x...)",
        }
      },
      required: ["chainName", "contractAddress"],
    },
  },
};
