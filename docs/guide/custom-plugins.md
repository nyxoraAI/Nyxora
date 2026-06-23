# Creating Custom Plugins

Nyxora operates on a modular, **Inversion of Control (IoC) Plugin Architecture**. This allows third-party developers to inject new capabilities into the agent without modifying the core execution engines (`web3Agent.ts` or `osAgent.ts`).

## The Plugin Interface

Every plugin in Nyxora must implement the `Plugin` interface located at `packages/core/src/plugin/types.ts`:

```typescript
export interface Plugin {
  /** The unique name of the plugin */
  name: string;
  
  /** A brief description of what the plugin does */
  description: string;
  
  /** Semantic versioning */
  version: string;
  
  /** An array of tool definitions formatted for the LLM */
  tools: any[];
  
  /** A mapping of tool names to their execution functions */
  handlers: Record<string, (args: any, context?: any) => Promise<any>>;
}
```

## Step 1: Create Your Plugin Class

To create a new capability (e.g., interacting with Spotify, fetching weather data, or integrating a custom Web3 protocol), create a new file inside `packages/core/src/system/plugins/` or `packages/core/src/web3/plugins/`.

Here is an example of a simple weather plugin:

```typescript
import { Plugin } from '../../plugin/types';

// 1. Define the Tool Schema for the LLM
const getWeatherToolDefinition = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Fetch the current weather for a specific city.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'The name of the city' }
      },
      required: ['city']
    }
  }
};

// 2. Define the execution logic
async function fetchWeather(city: string) {
  // Your logic here (e.g., calling an API)
  return `The weather in ${city} is currently 25°C and sunny.`;
}

// 3. Create the Plugin Class
export class CustomWeatherPlugin implements Plugin {
  public name = 'SystemWeatherPlugin';
  public description = 'Provides real-time weather information.';
  public version = '1.0.0';

  // Inject the schema
  public tools = [getWeatherToolDefinition];

  // Map the schema name to the execution logic
  public handlers = {
    [getWeatherToolDefinition.function.name]: async (args: any) => {
      return await fetchWeather(args.city);
    }
  };
}
```

## Step 2: Auto-Discovery

You no longer need to manually register your plugin! 

Nyxora features a fully autonomous **Auto-Discovery Engine**. Simply save your `.ts` file into the appropriate directory (`web3/plugins` or `system/plugins`).

When you start Nyxora (`npm run dev` or `npm start`), the engine will automatically scan those directories, dynamically import your class, and inject it into the global `PluginManager` without a single line of configuration.

## (Alternative) Dynamic URL Installation

Don't want to deal with moving files manually? You can instruct the Nyxora Agent to install a plugin directly from a URL!

Nyxora is equipped with the `SystemPluginInstallerPlugin`, an autonomous package manager.

Simply open the chat and say:
> *"Please install the weather plugin from this URL: https://raw.githubusercontent.com/username/repo/main/CustomWeatherPlugin.ts"*

Nyxora will:
1. Fetch the raw TypeScript code.
2. Verify that it implements the `Plugin` interface correctly (and attempts to auto-heal it if there are minor syntax issues).
3. Automatically segregate it into the correct `Web3` or `System` isolation zone based on its class name.
4. Ask for your **explicit manual approval** (Security Gate) before saving it to disk.

## Step 3: Architecture Separation (Web3 vs OS)

Nyxora intelligently segregates Web3 tools from OS/System tools based on the plugin's name.

> [!IMPORTANT]
> **Zero-Trust Boundaries**
> To ensure capability isolation:
> - If your plugin interacts with blockchains or wallets, its name **MUST** start with `Web3` (e.g., `Web3CustomDexPlugin`).
> - If your plugin interacts with APIs, the OS, or external systems, its name **MUST NOT** start with `Web3` (e.g., `SystemWeatherPlugin`, `GoogleWorkspacePlugin`).

The Nyxora API Server automatically reads the plugin names to securely route tools to either the Web3 Agent Context or the OS Agent Context.

## Step 4: UI Toggle Synchronization

Because Nyxora dynamically reads the `PluginManager`, any tool you add to your plugin will automatically appear in the backend's `/api/skills` endpoint. 

The web dashboard will automatically display your new skills, allowing users to toggle your custom capabilities on or off without you needing to write any frontend code!
