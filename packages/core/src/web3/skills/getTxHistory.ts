import { loadConfig } from '../../config/parser';
import { getAddress, ChainName } from '../config';
import { formatUnits } from 'viem';
import { safeFetchJson } from '../../utils/httpClient';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  sepolia: 11155111,
  base_sepolia: 84532,
  arbitrum_sepolia: 421614,
  optimism_sepolia: 11155420
};

export async function getTxHistory(chainName: ChainName, address?: string, days: number = 30): Promise<string> {
  try {
    const targetAddress = address || await getAddress();
    const chainId = CHAIN_IDS[chainName];
    if (!chainId) {
      return `Error: No chain ID configured for chain ${chainName}.`;
    }
    const apiUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}`;

    const config = loadConfig();
    const apiKey = config.web3?.explorer_api_key || 'YourApiKeyToken'; // Public fallback
    const apiKeyParam = apiKey ? `&apikey=${apiKey}` : '';

    const startTimestamp = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

    // Fetch Native Txs
    const nativeData = await safeFetchJson<any>(`${apiUrl}&module=account&action=txlist&address=${targetAddress}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc${apiKeyParam}`);

    // Fetch ERC20 Txs
    const tokenData = await safeFetchJson<any>(`${apiUrl}&module=account&action=tokentx&address=${targetAddress}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc${apiKeyParam}`);

    let history: any[] = [];

    if (nativeData.status === '1' && Array.isArray(nativeData.result)) {
      nativeData.result.forEach((tx: any) => {
        if (parseInt(tx.timeStamp) >= startTimestamp && tx.value !== '0') {
          const isReceive = String(tx.to || "").toLowerCase() === String(targetAddress || "").toLowerCase();
          history.push({
            Date: new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0],
            Type: isReceive ? 'Receive' : 'Send',
            Token: chainName === 'bsc' ? 'BNB' : chainName === 'polygon' ? 'MATIC' : 'ETH',
            Amount: formatUnits(BigInt(tx.value), 18),
            From: tx.from,
            To: tx.to,
            Hash: tx.hash,
            Fee_Native: isReceive ? '0' : formatUnits(BigInt(tx.gasUsed) * BigInt(tx.gasPrice), 18),
            timestamp: parseInt(tx.timeStamp)
          });
        }
      });
    }

    if (tokenData.status === '1' && Array.isArray(tokenData.result)) {
      tokenData.result.forEach((tx: any) => {
        if (parseInt(tx.timeStamp) >= startTimestamp) {
          const isReceive = String(tx.to || "").toLowerCase() === String(targetAddress || "").toLowerCase();
          history.push({
            Date: new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0],
            Type: isReceive ? 'Receive' : 'Send',
            Token: tx.tokenSymbol || 'Unknown',
            Amount: formatUnits(BigInt(tx.value), parseInt(tx.tokenDecimal || '18')),
            From: tx.from,
            To: tx.to,
            Hash: tx.hash,
            Fee_Native: isReceive ? '0' : formatUnits(BigInt(tx.gasUsed) * BigInt(tx.gasPrice), 18),
            timestamp: parseInt(tx.timeStamp)
          });
        }
      });
    }

    // Sort by timestamp desc
    history.sort((a, b) => b.timestamp - a.timestamp);

    // Remove timestamp property before returning
    history = history.map(({ timestamp, ...rest }) => rest);

    if (history.length === 0) {
      return `No transactions found for ${targetAddress} on ${chainName} in the last ${days} days.`;
    }

    return JSON.stringify(history);
  } catch (err: any) {
    return `Error fetching transaction history: ${err.message}`;
  }
}

export const getTxHistoryToolDefinition = {
  type: "function",
  function: {
    name: "get_tx_history",
    description: "Fetches the transaction history (Native and ERC-20 transfers) for an address on a specific chain over the last N days. Returns a structured JSON array suitable for generating Excel reports.",
    parameters: {
      type: "object",
      properties: {
        chainName: {
          type: "string",
          description: "The name of the blockchain (e.g., base, ethereum, bsc, arbitrum).",
        },
        address: {
          type: "string",
          description: "Optional. The wallet address. If omitted, uses the agent's own wallet.",
        },
        days: {
          type: "number",
          description: "Optional. Number of days to look back. Default is 30.",
        }
      },
      required: ["chainName"],
    },
  },
};
