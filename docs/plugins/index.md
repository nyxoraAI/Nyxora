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

## 🛠️ Tutorial Mendalam: Membuat Custom MCP Plugin

Selain skill otonom, Anda juga dapat menulis plugin MCP secara manual untuk menghubungkan Nyxora dengan layanan eksternal (misalnya API harga kustom atau database internal). 

Plugin MCP Nyxora diimplementasikan menggunakan arsitektur modular TypeScript. Berikut adalah contoh cara membuat plugin sederhana.

### 1. Struktur File
Buat file TypeScript baru di dalam direktori `packages/mcp-server/src/plugins/`:
```bash
touch packages/mcp-server/src/plugins/priceOraclePlugin.ts
```

### 2. Implementasi Kode Plugin (Code Snippet)
Berikut adalah pola dasar (`boilerplate`) untuk membuat plugin MCP Nyxora yang valid:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Mendaftarkan plugin khusus ke dalam MCP Server Nyxora
 */
export function registerPriceOraclePlugin(server: McpServer) {
  
  // Daftarkan tool 'get_custom_price' agar bisa dipanggil oleh AI eksternal
  server.tool(
    "get_custom_price",
    "Mendapatkan harga aset kripto dari Oracle Internal",
    {
      symbol: z.string().describe("Simbol aset (contoh: ETH, BTC)"),
    },
    async ({ symbol }) => {
      try {
        // Logika eksekusi plugin Anda
        const price = await fetchInternalOraclePrice(symbol);
        
        // Response wajib dikembalikan dalam format MCP TextContent
        return {
          content: [
            {
              type: "text",
              text: `Harga saat ini untuk ${symbol} adalah $${price}`,
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Gagal mengambil harga: ${error.message}`,
            }
          ],
          isError: true,
        };
      }
    }
  );
}

// Fungsi internal simulasi
async function fetchInternalOraclePrice(symbol: string): Promise<number> {
  // Panggil API Anda di sini
  return 3500.50; 
}
```

### 3. Mendaftarkan Plugin ke Entry Point
Setelah file plugin dibuat, daftarkan plugin tersebut ke dalam eksekusi utama MCP Server di `packages/mcp-server/src/index.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPriceOraclePlugin } from "./plugins/priceOraclePlugin.js";

const server = new McpServer({
  name: "Nyxora MCP Node",
  version: "1.0.0"
});

// Panggil fungsi registrasi
registerPriceOraclePlugin(server);

// ... setup transport (StdioServerTransport)
```

Dengan langkah ini, plugin kustom Anda (misalnya `get_custom_price`) akan segera dikenali oleh klien eksternal seperti Claude Desktop yang terhubung ke daemon Nyxora!
