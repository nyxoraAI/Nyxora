import { describe, it, expect, beforeAll } from 'vitest';
import { pluginManager, initializePlugins } from './registry';

describe('Skill Schema Validation', () => {
  beforeAll(async () => {
    await initializePlugins();
  });

  it('should load plugins successfully', () => {
    const plugins = pluginManager.getPlugins();
    expect(plugins.length).toBeGreaterThan(0);
  });

  it('all skill schemas must be strictly valid', () => {
    const plugins = pluginManager.getPlugins();
    let totalSkills = 0;
    
    for (const plugin of plugins) {
      for (const tool of plugin.tools) {
        totalSkills++;
        
        // Ensure it's a function tool
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();
        
        // Basic properties
        expect(tool.function.name).toBeTruthy();
        expect(typeof tool.function.name).toBe('string');
        
        expect(tool.function.description).toBeTruthy();
        expect(typeof tool.function.description).toBe('string');
        
        // Parameters block
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe('object');
        
        // It should have properties or be an empty object
        if (tool.function.parameters.properties) {
          expect(typeof tool.function.parameters.properties).toBe('object');
        }
      }
    }
    
    console.log(`Validated ${totalSkills} skills across ${plugins.length} plugins.`);
  });
});
