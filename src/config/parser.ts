import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import { getPath } from './paths';

export interface NyxoraConfig {
  agent: {
    name: string;
    default_chain: string;
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'ollama' | 'gemini';
    model: string;
    temperature: number;
    api_keys?: string[];
    credentials?: {
      openai_key?: string;
      gemini_key?: string;
      openrouter_key?: string;
    };
  };
  memory: {
    type: string;
    path: string;
  };
  web3?: {
    rpc_urls?: Record<string, string>;
  };
  integrations?: {
    telegram?: {
      enabled: boolean;
      bot_token?: string;
    };
  };
}

export function loadConfig(): NyxoraConfig {
  const configPath = getPath('config.yaml');
  try {
    const file = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.parse(file);
    return parsed as NyxoraConfig;
  } catch (error) {
    console.error('Failed to load config.yaml. Using default configuration.', error);
    return {
      agent: { name: 'Nyxora-Default', default_chain: 'base' },
      llm: { 
        provider: 'openai', 
        model: 'gpt-4o-mini', 
        temperature: 0.2, 
        api_keys: [],
        credentials: {}
      },
      memory: { type: 'file', path: './memory.json' },
      web3: { rpc_urls: {} },
      integrations: {
        telegram: { enabled: false }
      }
    };
  }
}

export function saveConfig(newConfig: NyxoraConfig): void {
  const configPath = getPath('config.yaml');
  try {
    const yamlStr = yaml.stringify(newConfig);
    fs.writeFileSync(configPath, yamlStr, 'utf8');
  } catch (error) {
    console.error('Failed to save config.yaml', error);
  }
}
