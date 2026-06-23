import { Plugin } from './types';

export class PluginManager {
  private plugins: Plugin[] = [];

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
   * Gets all tool definitions from all registered plugins.
   * This array is sent directly to the LLM.
   */
  public getAllToolDefinitions(): any[] {
    return this.plugins.flatMap(p => p.tools);
  }

  /**
   * Executes a tool dynamically by routing to the correct plugin handler.
   */
  public async executeTool(toolName: string, args: any, context?: any): Promise<any> {
    for (const plugin of this.plugins) {
      if (plugin.handlers[toolName]) {
        return await plugin.handlers[toolName](args, context);
      }
    }
    
    // Fallback if tool is not found, allows progressive migration
    return null;
  }
}
