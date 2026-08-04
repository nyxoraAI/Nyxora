# Plugin System Overview

Nyxora boasts a highly extensible and robust plugin architecture. Rather than building a monolithic application, the core daemon operates as a lightweight runtime, delegating domain-specific logic to independently managed plugins.

This modularity allows community developers to rapidly integrate new blockchain networks, DeFi protocols, external APIs, and AI models without touching the core routing engine.

## 🔸 Types of Plugins

The Nyxora ecosystem supports three distinct categories of plugins:

### 1. DeFi Providers & Aggregators
These plugins hook into the `AggregatorRegistry` to provide real-time liquidity and routing paths for token swaps and bridging. They operate inside a strict Zero-Trust sandbox (prevented from accessing private keys).
*Examples: Jupiter Provider, 1inch Provider, LI.FI Provider.*

### 2. Custom Agentic Skills
Skills are discrete, single-purpose functions that empower the AI Agent to perform actions (e.g., fetching a Twitter feed, executing a shell command, or analyzing a smart contract). These are injected directly into the LLM's tool-calling context.
*Examples: Web Search Skill, Github PR Reviewer Skill, Etherscan Reader.*

### 3. Cross-Chain Bridges
Specialized routing plugins designed to facilitate the movement of assets across disparate L1 and L2 networks.
*Examples: Optimism Native Bridge, Arbitrum Orbit Bridge.*

## ✨ Autonomous Skill Creation

Nyxora does not use a traditional CLI command (like `npm install` or `nyxora install`) for custom plugins and skills. Instead, expansion is handled autonomously by the LLM itself via the `skillExtractor`!

Simply tell your Nyxora Agent in the chat (via Terminal, Dashboard, or Telegram):
> *"Hey Nyxora, please memorize this workflow as a new skill named 'fetch_airdrop_eligibility' and save it."*

Nyxora will dynamically generate the Node.js execution logic and the required schema, scanning the code for security violations (preventing unauthorized private key access), and install it directly into your `~/.nyxora/skills/` directory. The new skill becomes permanently available across all future sessions!

---

## 🛠️ In-Depth Tutorial: Building a Custom MCP Plugin

In addition to autonomous skills, you can manually write custom MCP plugins to connect Nyxora with external services (such as custom price APIs or internal databases).

Nyxora MCP plugins are implemented using a modular TypeScript architecture. Below is an example of how to create a simple custom plugin.

### 1. File Structure
Create a new TypeScript file inside the `packages/mcp-server/src/plugins/` directory:
```bash
touch packages/mcp-server/src/plugins/priceOraclePlugin.ts
```

### 2. Plugin Implementation (Code Snippet)
Here is the standard boilerplate for creating a valid Nyxora MCP plugin:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registers a custom plugin into the Nyxora MCP Server
 */
export function registerPriceOraclePlugin(server: McpServer) {
  
  // Register tool 'get_custom_price' so it can be invoked by external AI clients
  server.tool(
    "get_custom_price",
    "Fetches crypto asset price from an Internal Oracle",
    {
      symbol: z.string().describe("Asset symbol (e.g., ETH, BTC)"),
    },
    async ({ symbol }) => {
      try {
        // Execute your custom plugin logic
        const price = await fetchInternalOraclePrice(symbol);
        
        // Response must be returned in MCP TextContent format
        return {
          content: [
            {
              type: "text",
              text: `The current price of ${symbol} is $${price}`,
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch price: ${error.message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

// Simulated internal helper function
async function fetchInternalOraclePrice(symbol: string): Promise<number> {
  // Invoke your API here
  return 3500.50; 
}
```

### 3. Registering the Plugin with the Entry Point
Once your plugin file is created, register it within the main MCP Server entry point at `packages/mcp-server/src/index.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPriceOraclePlugin } from "./plugins/priceOraclePlugin.js";

const server = new McpServer({
  name: "Nyxora MCP Node",
  version: "1.0.0"
});

// Invoke the registration function
registerPriceOraclePlugin(server);

// ... setup transport (StdioServerTransport)
```

With this configuration, your custom plugin (e.g., `get_custom_price`) will immediately be recognized by external clients such as Claude Desktop connected to the Nyxora daemon!
