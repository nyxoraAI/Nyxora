import { PluginManager } from './PluginManager';
import fs from 'fs';
import path from 'path';

export const pluginManager = new PluginManager();

let isInitialized = false;

export async function initializePlugins() {
  if (isInitialized) return;
  
  await pluginManager.initialize(); // Initialize agentskills.io scanner
  
  const pluginDirs = [
    path.join(__dirname, '../web3/plugins'),
    path.join(__dirname, '../system/plugins')
  ];

  for (const dir of pluginDirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of files) {
      const fullPath = path.join(dir, file);
      
      try {
        const module = await import(fullPath);
        
        for (const exported of Object.values(module)) {
          if (typeof exported === 'function') {
            try {
              const instance = new (exported as any)();
              if (instance.name && instance.version && instance.tools && instance.handlers) {
                pluginManager.register(instance);
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error(`[PluginManager] Failed to load plugin from ${file}:`, err);
      }
    }
  }
  
  isInitialized = true;
}
