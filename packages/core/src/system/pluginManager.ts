import fs from 'fs';
import path from 'path';
import vm from 'vm';

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
          const absolutePath = path.resolve(pluginsDir, file);
          const code = fs.readFileSync(absolutePath, 'utf8');
          
          // Construct a restricted require function for the sandbox
          const restrictedRequire = (moduleName: string) => {
            const blockedModules = ['fs', 'child_process', 'os', 'net', 'tls', 'cluster', 'worker_threads'];
            if (blockedModules.includes(moduleName)) {
              throw new Error(`Sandboxing error: Access to the '${moduleName}' module is blocked for security reasons.`);
            }
            // Allow fetch and other safe modules by delegating to actual require
            return require(moduleName);
          };

          // Create the sandbox environment
          const sandbox = {
            require: restrictedRequire,
            console: console,
            module: { exports: {} as any },
            exports: {},
            process: { env: {} }, // Hide actual environment variables
            Buffer: Buffer,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            setInterval: setInterval,
            clearInterval: clearInterval,
          };

          const context = vm.createContext(sandbox);
          const script = new vm.Script(code, { filename: file });
          
          // Execute the plugin code inside the VM
          script.runInContext(context);
          
          const moduleExports = sandbox.module.exports;

          if (moduleExports.toolDefinition && moduleExports.execute) {
            const toolName = moduleExports.toolDefinition.function.name;
            this.skills.set(toolName, moduleExports as ExternalSkill);
            console.log(`[PluginManager] Loaded sandboxed external skill: ${toolName}`);
          }
        } catch (error: any) {
          console.error(`[PluginManager] Failed to load sandboxed plugin ${file}:`, error.message);
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
