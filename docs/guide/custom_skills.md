# Guide to Creating Secure Nyxora Skills (Plugins)

Welcome to the Nyxora development ecosystem! With the implementation of our **VM Sandbox Architecture**, you can safely download and run *External Skills* (Plugins) from the community without risking your system's security.

Below is a comprehensive tutorial on how to create third-party *Skills* that are fully compatible with Nyxora's Sandbox.

---

## 1. Sandbox Golden Rules

Before writing any code, it is crucial to understand the strict boundaries of your *Skill*:

::: danger STRICTLY BLOCKED MODULES
You **CANNOT** use modules such as `fs`, `child_process`, `os`, `net`, `tls`, `cluster`, or `worker_threads`.
If your code attempts to `require('fs')`, the plugin will be instantly choked by the system and rejected immediately (Crash).
:::

::: tip PERMITTED MODULES
You are fully permitted to perform mathematical computations, text processing (Regex), `crypto`, and utilize external networking libraries such as `node-fetch` or `axios` to fetch data from public APIs.
:::

---

## 2. Basic Structure of a Skill

Every *Skill* file (ending in `.js` or `.ts`) placed inside the `src/external_skills/` directory must export two primary elements:
1. `toolDefinition`: A JSON structure (OpenAI schema format) that tells the Nyxora AI what this *Skill* does and what parameters it requires.
2. `execute`: An asynchronous function that will be called by the AI, passing the requested arguments (`args`).

---

## 3. Practical Example: Price Checker Skill

Let's create a plugin named `getPrice.js` whose job is to fetch prices from a public API. Notice how secure this code is.

```javascript
// You can require modules that are permitted by the Sandbox
const fetch = require('node-fetch');

module.exports = {
  // 1. Tell Nyxora AI what this tool does
  toolDefinition: {
    type: "function",
    function: {
      name: "get_external_price",
      description: "Fetch crypto asset prices from external APIs (CoinGecko/Binance)",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "Coin symbol, e.g., BTC, ETH, SOL"
          }
        },
        required: ["symbol"]
      }
    }
  },

  // 2. Main execution function
  execute: async (args) => {
    try {
      const coinSymbol = args.symbol.toUpperCase();
      
      // Using fetch from within the Sandbox (Safe)
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coinSymbol}USDT`);
      
      if (!response.ok) {
        return `Failed to fetch price for ${coinSymbol}. Please ensure the symbol is correct.`;
      }

      const data = await response.json();
      return `The current price for ${coinSymbol} is $${parseFloat(data.price).toFixed(2)} USDT.`;
      
    } catch (error) {
      return `Sandbox returned an Error: ${error.message}`;
    }
  }
};
```

---

## 4. How to Install & Test Your Skill

1. Save the code above into a file named `src/external_skills/get_external_price.js`.
2. When Nyxora boots up (via `npm run start`), the `PluginManager` will automatically detect the file.
3. The code will be read and injected into the **VM Context**. If no malicious code (like `require('fs')`) is found, the plugin will be loaded.
4. On Telegram or your Terminal, you can simply ask Nyxora: *"What is the current price of SOL?"*
5. Nyxora will safely utilize your custom plugin!

::: info Security Harmony
If a community-made plugin requires the ability to **save local files**, it cannot do so on its own. It must return raw data back to the Nyxora AI, and the Nyxora AI will internally invoke its *Native Skill* (`writeFile`) after passing the rigorous *NLP Security Policy* evaluation. This creates the perfect security harmony!
:::
