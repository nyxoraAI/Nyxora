import fs from 'fs';
import path from 'path';
import ivm from 'isolated-vm';
import { getAppDir } from '../config/paths';

// Define how an external skill should look like
export interface ExternalSkill {
  toolDefinition: any;
  execute: (args: any) => Promise<string> | string;
}

export class PluginManager {
  private skills: Map<string, ExternalSkill> = new Map();

  async loadPlugins() {
    const pluginsDir = path.join(getAppDir(), 'plugins');
    
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

          const isolate = new ivm.Isolate({ memoryLimit: 128 });
          const context = isolate.createContextSync();
          const jail = context.global;
          jail.setSync('global', jail.derefInto());
          
          // Inject a safe fetch
          const safeFetch = new ivm.Reference(async (url: string, options: any) => {
             if (url.includes('127.0.0.1') || url.includes('localhost') || url.includes('::1')) {
                 throw new Error("SSRF Protection: Access to localhost is blocked.");
             }
             const res = await fetch(url, options);
             const text = await res.text();
             return text; // Only return text to avoid passing complex Response objects
          });
          jail.setSync('fetchText', safeFetch);
          
          // Inject console
          const logCallback = new ivm.Reference((...args: any[]) => console.log('[Plugin]', ...args));
          jail.setSync('log', logCallback);

          const scriptCode = `
             const console = { log: (...args) => log(...args) };
             const fetch = async (url, options) => {
                const text = await fetchText.apply(undefined, [url, options], { arguments: { copy: true }, result: { promise: true } });
                return { text: async () => text, json: async () => JSON.parse(text) };
             };
             const module = { exports: {} };
             const exports = module.exports;
             ${code}
             module.exports;
          `;

          const script = isolate.compileScriptSync(scriptCode, { filename: file });
          const moduleExportsRef = script.runSync(context);

          const toolDefinition = moduleExportsRef.getSync('toolDefinition');
          const executeRef = moduleExportsRef.getSync('execute');

          if (toolDefinition && executeRef && typeof executeRef === 'object') {
             const toolName = toolDefinition.function.name;
             
             const safeExecute = async (args: any) => {
                const result = await executeRef.apply(undefined, [args], { arguments: { copy: true }, result: { promise: true, copy: true } });
                return result;
             };

             this.skills.set(toolName, { toolDefinition, execute: safeExecute });
             console.log(`[PluginManager] Loaded sandboxed external skill: ${toolName}`);
          }
          
          moduleExportsRef.release();
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
