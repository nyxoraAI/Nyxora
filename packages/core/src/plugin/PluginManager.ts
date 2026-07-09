import { Plugin } from './types';
import { AgentSkills } from '../system/agentskills';

export interface ToolContext {
  sessionId?: string;
  toolCallId?: string;
  responseMessage?: any; // The original LLM message
}

export interface BeforeToolCallResult {
  block?: boolean;
  reason?: string;
}

export interface AfterToolCallResult {
  content?: string;
  terminate?: boolean;
  isError?: boolean;
}

export interface ToolHook {
  name: string;
  beforeToolCall?: (toolName: string, args: any, context: ToolContext) => Promise<BeforeToolCallResult | void>;
  afterToolCall?: (toolName: string, args: any, result: any, context: ToolContext) => Promise<AfterToolCallResult | void>;
  resolveDeferredTool?: (toolName: string) => Promise<{ name: string, handler: Function } | null>;
}

export class PluginManager {
  private plugins: Plugin[] = [];
  public agentSkills: AgentSkills;
  private hooks: ToolHook[] = [];

  constructor() {
    this.agentSkills = new AgentSkills();
  }

  public async initialize(): Promise<void> {
    await this.agentSkills.discoverSkills();
  }

  public register(plugin: Plugin) {
    console.log(`[PluginManager] Registered plugin: ${plugin.name} v${plugin.version}`);
    this.plugins.push(plugin);
  }

  public registerHook(hook: ToolHook) {
    console.log(`[PluginManager] Registered hook: ${hook.name}`);
    this.hooks.push(hook);
  }

  public getPlugins(): Plugin[] {
    return this.plugins;
  }

  public getAllToolDefinitions(): any[] {
    const pluginTools = this.plugins.flatMap(p => p.tools);
    const agentTools = this.agentSkills.getToolSchemas();
    const allTools = [...pluginTools, ...agentTools];

    const uniqueTools: any[] = [];
    const seenNames = new Set<string>();
    for (const t of allTools) {
      if (t?.function?.name) {
        if (!seenNames.has(t.function.name)) {
          seenNames.add(t.function.name);
          uniqueTools.push(t);
        }
      } else {
        uniqueTools.push(t);
      }
    }
    return uniqueTools;
  }

  public async triggerBeforeHooks(toolName: string, args: any, context: ToolContext): Promise<BeforeToolCallResult> {
    for (const hook of this.hooks) {
      if (hook.beforeToolCall) {
        const res = await hook.beforeToolCall(toolName, args, context);
        if (res && res.block) return res;
      }
    }
    return {};
  }

  public async triggerAfterHooks(toolName: string, args: any, result: any, context: ToolContext): Promise<AfterToolCallResult> {
    let finalResult: AfterToolCallResult = { content: result };
    for (const hook of this.hooks) {
      if (hook.afterToolCall) {
        const res = await hook.afterToolCall(toolName, args, finalResult.content, context);
        if (res) {
          finalResult = { ...finalResult, ...res };
        }
      }
    }
    return finalResult;
  }

  private async tryResolveDeferred(toolName: string): Promise<{ name: string, handler: Function } | null> {
    for (const hook of this.hooks) {
      if (hook.resolveDeferredTool) {
        const resolved = await hook.resolveDeferredTool(toolName);
        if (resolved) return resolved;
      }
    }
    return null;
  }

  public async executeTool(
    toolName: string, 
    args: any, 
    context: ToolContext = {},
    onUpdate?: (partial: string) => void
  ): Promise<any> {
    // 1. Check Native Plugins First
    for (const plugin of this.plugins) {
      if (plugin.handlers[toolName]) {
        // Assume native handlers can accept onUpdate if they need to
        return await plugin.handlers[toolName](args, { ...context, onUpdate });
      }
    }
    
    // 2. Fallback to agentskills.io structure
    if (this.agentSkills.getSkillManifest(toolName)) {
      // agentskills doesn't stream yet, so we just await execution
      return await this.agentSkills.executeSkill(toolName, args);
    }
    
    // 3. Try Deferred Tool Resolution (e.g. MCP Servers)
    const deferred = await this.tryResolveDeferred(toolName);
    if (deferred) {
       return await deferred.handler(args, { ...context, onUpdate });
    }

    return null;
  }
}
