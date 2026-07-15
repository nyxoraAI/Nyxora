# Creating Custom Skills

A **Skill** in Nyxora is a discrete, single-purpose action that the AI Agent can invoke. Instead of wrapping them in complex Zod-schema plugins, Nyxora uses raw, standard OpenAI Tool Definitions for maximum compatibility and minimal overhead.

## ⚡ The Anatomy of a Nyxora Skill

Unlike other frameworks that force you to learn proprietary schema builders (like Zod) or complex class inheritance, Nyxora is designed to be as close to the metal as possible. Every custom skill is built using the **Native OpenAI Tool Definition standard**.

To create a new skill, you only need to export two things from a single TypeScript file:
1. **The Execution Function:** A pure async TypeScript function containing your logic.
2. **The Tool Definition:** A static JSON object describing your function to the LLM.

---

## ✨ Step-by-Step: Building a "Get Balance" Skill

Let's build a simple custom skill that allows the AI to check the native token balance of a specific address.

### 1. File Placement
Custom skills should not be placed inside the core repository. Instead, place your new `.ts` file inside your local Nyxora configuration directory:
`~/.nyxora/skills/checkBalance.ts`

### 2. The Execution Function
Your function should accept a `params` object and **always return a string**. The LLM consumes strings much more reliably than nested JSON objects.

```typescript
import { createPublicClient, http, formatEther } from 'viem';
import { mainnet } from 'viem/chains';

// Define the interface for the parameters the AI will pass
interface CheckBalanceParams {
  walletAddress: string;
}

// 1. The Execution Logic
export async function checkBalance(params: CheckBalanceParams): Promise<string> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http()
    });

    // Fetch the balance from the blockchain
    const balanceWei = await client.getBalance({ 
      address: params.walletAddress as \`0x\${string}\` 
    });
    
    const balanceEth = formatEther(balanceWei);
    
    // Always return a clear, descriptive string for the AI to read
    return \`Success: The balance for \${params.walletAddress} is \${balanceEth} ETH.\`;
    
  } catch (error: any) {
    return \`Failed to fetch balance: \${error.message}\`;
  }
}
```

### 3. The OpenAI Tool Definition
Next, you must define the exact JSON schema that tells the LLM *how* and *when* to use your function. This must strictly follow the OpenAI Function Calling format.

```typescript
// 2. The Tool Definition
export const checkBalanceToolDefinition = {
  type: "function",
  function: {
    name: "check_balance",
    description: "Fetches the native ETH balance for a given Ethereum wallet address.",
    parameters: {
      type: "object",
      properties: {
        walletAddress: {
          type: "string",
          description: "The 0x-prefixed Ethereum wallet address to check."
        }
      },
      // Ensure the AI always provides the required parameters
      required: ["walletAddress"]
    }
  }
};
```

---

## 📌 Registration & Auto-Discovery

Nyxora features an autonomous **Skill Auto-Discovery Engine**. You do not need to manually import or register your new skill in any central `index.ts` file!

1. Save your file in the `~/.nyxora/skills/` directory.
2. Restart your background daemon using the CLI:
   ```bash
   nyxora restart
   ```
3. Open the chat interface (`nyxora chat`) and ask: *"What is the balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?"*

The Nyxora Brain will dynamically scan the `skills/` directory on boot, parse your `checkBalanceToolDefinition`, and seamlessly equip the AI agent with your new capability.
