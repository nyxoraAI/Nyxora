import { Plugin } from './types';
import { AgentSkills } from '../system/agentskills';

export class PluginManager {
  private plugins: Plugin[] = [];
  public agentSkills: AgentSkills;

  constructor() {
    this.agentSkills = new AgentSkills();
  }

  public async initialize(): Promise<void> {
    await this.agentSkills.discoverSkills();
  }

  /**
   * Registers a new plugin to the manager.
   */
  public register(plugin: Plugin) {
    console.log(`[PluginManager] Registered plugin: ${plugin.name} v${plugin.version}`);
    this.plugins.push(plugin);
  }

  /**
   * Returns all registered plugins.
   */
  public getPlugins(): Plugin[] {
    return this.plugins;
  }

  /**
   * Gets all tool definitions from all registered plugins AND agentskills.
   * This array is sent directly to the LLM.
   */
  public getAllToolDefinitions(): any[] {
    const pluginTools = this.plugins.flatMap(p => p.tools);
    const agentTools = this.agentSkills.getToolSchemas();
    return [...pluginTools, ...agentTools];
  }

  /**
   * Executes a tool dynamically by routing to the correct plugin handler or agentskill script.
   */
  public async executeTool(toolName: string, args: any, context?: any): Promise<any> {
    // 1. Check Native Plugins First
    for (const plugin of this.plugins) {
      if (plugin.handlers[toolName]) {
        return await plugin.handlers[toolName](args, context);
      }
    }
    
    // 2. Fallback to agentskills.io structure
    if (this.agentSkills.getSkillManifest(toolName)) {
      return await this.agentSkills.executeSkill(toolName, args);
    }
    
    // Fallback if tool is not found, allows progressive migration
    return null;
  }
}
