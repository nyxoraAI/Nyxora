import fs from 'fs';
import path from 'path';

// Define how an external skill should look like
export interface ExternalSkill {
  toolDefinition: any;
  execute: (args: any) => Promise<string> | string;
}

export class PluginManager {
  private skills: Map<string, ExternalSkill> = new Map();

  async loadPlugins() {
    const pluginsDir = path.join(process.cwd(), 'src', 'external_skills');
    
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(pluginsDir);
    
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        try {
          // Dynamic import requires relative path from this file or absolute path
          // For TS compiled to JS, absolute path is safer
          const absolutePath = path.resolve(pluginsDir, file);
          
          // Note: In development with ts-node, requiring .ts works. 
          // In production, we need compiled .js files.
          const module = require(absolutePath);
          
          if (module.toolDefinition && module.execute) {
            const toolName = module.toolDefinition.function.name;
            this.skills.set(toolName, module as ExternalSkill);
            console.log(`[PluginManager] Loaded external skill: ${toolName}`);
          }
        } catch (error) {
          console.error(`[PluginManager] Failed to load plugin ${file}:`, error);
        }
      }
    }
  }

  getToolDefinitions(): any[] {
    return Array.from(this.skills.values()).map(skill => skill.toolDefinition);
  }

  async executeTool(toolName: string, args: any): Promise<string | null> {
    const skill = this.skills.get(toolName);
    if (skill) {
      try {
        return await skill.execute(args);
      } catch (error: any) {
        return `External skill ${toolName} failed: ${error.message}`;
      }
    }
    return null; // Tool not found in external skills
  }
}

export const pluginManager = new PluginManager();
