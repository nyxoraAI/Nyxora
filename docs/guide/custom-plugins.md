# Creating Custom Skills

Nyxora operates on a modular, **Inversion of Control (IoC) Plugin Architecture**. With the recent "Hermes Adaptation," we have introduced the **`agentskills.io`** standard, allowing third-party developers and users to inject new capabilities into the agent in a highly decoupled, modular way.

## The `agentskills.io` Standard

Unlike native Web3 skills (which are hardcoded into the `packages/core/src/web3/plugins/` directory), Custom Skills are standalone modular directories.

By default, Nyxora scans the global directory for your custom skills:
`~/.nyxora/skills/`

A valid custom skill directory must contain two files:
1. `SKILL.md` (The Manifest)
2. `scripts/execute.ts` (The Logic)

### Step 1: Create the Manifest (`SKILL.md`)

The `SKILL.md` file defines the identity and the LLM schema of your skill. The schema tells Nyxora's reasoning engine exactly what this tool does and what arguments it needs.

Create a folder `~/.nyxora/skills/my_weather_skill/` and add `SKILL.md`:

```markdown
# MyWeatherSkill
Version: 1.0.0
Description: Provides real-time weather information.

## Schema
{
  "name": "get_weather",
  "description": "Fetch the current weather for a specific city.",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "The name of the city" }
    },
    "required": ["city"]
  }
}
```

### Step 2: Create the Execution Logic (`scripts/execute.ts`)

Inside the same folder, create a `scripts/execute.ts` file. This file must export a default `execute` function that takes the arguments defined in your schema.

```typescript
// ~/.nyxora/skills/my_weather_skill/scripts/execute.ts

export async function execute(args: { city: string }): Promise<string> {
  const { city } = args;
  
  try {
    // Your logic here (e.g., calling a weather API)
    // For demonstration, we'll just return a mock string.
    return `The weather in ${city} is currently 25°C and sunny.`;
  } catch (error: any) {
    return `[Weather Skill Error] Failed to fetch weather: ${error.message}`;
  }
}
```

### Step 3: Auto-Discovery

You do not need to manually register your skill! 

Nyxora features a fully autonomous **Auto-Discovery Engine** (`AgentSkills`). When you start Nyxora (`npm run start`), the engine will automatically scan the `~/.nyxora/skills/` directory, dynamically parse your `SKILL.md`, compile your `execute.ts`, and inject it into the global `PluginManager` without a single line of configuration.

---

## Autonomous Skill Synthesizing (AI Creating AI)

Don't want to write code manually? Nyxora possesses the meta-ability to create skills for itself using the `skillExtractor.ts` engine!

Simply open the chat and instruct Nyxora:
> *"Nyxora, I want you to memorize a new workflow. Whenever I ask for the weather, fetch it from wttr.in. Please create a new skill for this named `auto_weather`."*

Nyxora will:
1. Autonomously write the `execute.ts` logic.
2. Autonomously generate the `SKILL.md` schema.
3. Save the new modular folder directly into `~/.nyxora/skills/auto_weather/`.
4. The skill will be available immediately or upon the next daemon reboot.

## UI Toggle Synchronization

Because Nyxora dynamically reads the `PluginManager` and `AgentSkills`, any tool you add to your `~/.nyxora/skills/` directory will automatically appear in the backend's `/api/skills` endpoint. 

The web dashboard will automatically display your new skills, allowing users to toggle your custom capabilities on or off without you needing to write any frontend code!
