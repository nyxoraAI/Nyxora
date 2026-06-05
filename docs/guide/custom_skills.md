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

::: tip PERMITTED MODULES (The Pure V8 Environment)
**You CANNOT use `require()` or `import`.**
The sandbox is a pure V8 Isolate, meaning it has zero access to Node.js modules. You cannot use external NPM packages like `axios`, `node-fetch`, or native Node modules like `crypto`. 

**How to make Network Requests:**
Instead of `axios`, the Nyxora Engine has securely injected a global `fetch()` function into your sandbox. You must use this native `fetch` API. This custom fetch is equipped with SSRF protection, meaning any attempt to call `localhost` or `127.0.0.1` will be blocked.
:::

---

## 2. Basic Structure of a Skill

Although Nyxora itself is written natively in TypeScript (TS), **External Skills MUST be written in pure JavaScript (JS).** 
Why? Because the V8 Sandbox Engine (`isolated-vm`) compiles the code directly at runtime. It does not have a built-in TypeScript transpiler. If you write TypeScript annotations (like `let data: string`), the sandbox will instantly crash with a Syntax Error.

Every Skill file must export two things:
1. `toolDefinition`: A JSON Schema describing your tool for the AI LLM.
2. `execute`: An asynchronous function containing your logic.

---

## 3. Practical Example: Price Checker Skill

Let's create a plugin named `getPrice.js` whose job is to fetch prices from a public API. Notice how secure this code is.

```javascript
// Do NOT use require(). The fetch function is already injected globally by the Sandbox.

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

## 4. How to Install External Skills

There are two primary ways to install an external skill into Nyxora:

### Method A: Automated Installation (AI Prompt)
Because Nyxora has a Native OS-Level Skill called `installSkill`, you can simply command the AI to install plugins for you.
1. Send a message to your agent: *"Nyxora, please install the weather-plugin skill."*
2. The AI will evaluate this request against the NLP Security Policy.
3. If approved, the AI will autonomously download the plugin, save it to the `src/external_skills/` directory, and the PluginManager will hot-reload it into the VM Sandbox.

### Method B: Manual Installation (Developer Mode)
If you are developing your own skill (like the Price Checker above):
1. Save your JavaScript code into a file named `src/external_skills/get_external_price.js`.
2. When Nyxora boots up (via `nyxora start` or `npm start`), the `PluginManager` will automatically detect the file.
3. The code will be read and injected into the **VM Context**. If no syntax errors or forbidden requires are found, the plugin will be loaded.
4. On Telegram or your Terminal, you can simply ask Nyxora: *"What is the current price of SOL?"*
5. Nyxora will safely utilize your custom plugin!

::: info Security Harmony
If a community-made plugin requires the ability to **save local files**, it cannot do so on its own. It must return raw data back to the Nyxora AI, and the Nyxora AI will internally invoke its *Native Skill* (`writeFile`) after passing the rigorous *NLP Security Policy* evaluation. This creates the perfect security harmony!
:::
