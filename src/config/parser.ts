import fs from 'fs';
import yaml from 'yaml';
import path from 'path';

export interface OpenWebConfig {
  agent: {
    name: string;
    default_chain: string;
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'ollama' | 'gemini';
    model: string;
    temperature: number;
    api_keys?: string[];
  };
  memory: {
    type: string;
    path: string;
  };
}

export function loadConfig(): OpenWebConfig {
  const configPath = path.resolve(process.cwd(), 'config.yaml');
  try {
    const file = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.parse(file);
    return parsed as OpenWebConfig;
  } catch (error) {
    console.error('Failed to load config.yaml. Using default configuration.', error);
    return {
      agent: { name: 'OpenWeb-Default', default_chain: 'base' },
      llm: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.2, api_keys: [] },
      memory: { type: 'file', path: './memory.json' }
    };
  }
}

export function saveConfig(newConfig: OpenWebConfig): void {
  const configPath = path.resolve(process.cwd(), 'config.yaml');
  try {
    const yamlStr = yaml.stringify(newConfig);
    fs.writeFileSync(configPath, yamlStr, 'utf8');
  } catch (error) {
    console.error('Failed to save config.yaml', error);
  }
}
