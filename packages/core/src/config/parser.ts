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
    provider: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'openrouter';
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
  permissions?: {
    web3?: {
      allow_transfer?: boolean;
      allow_swap?: boolean;
      max_usd_per_tx?: number;
    };
    system?: {
      allow_shell_execution?: boolean;
      allow_file_write?: boolean;
    };
  };
}

export function loadConfig(): NyxoraConfig {
  const configPath = getPath('config.yaml');
  try {
    const file = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.parse(file) as Partial<NyxoraConfig>;
    
    // Merge with defaults
    return {
      agent: parsed.agent || { name: 'Nyxora-Default', default_chain: 'base' },
      llm: parsed.llm || { 
        provider: 'openai', 
        model: 'gpt-4o-mini', 
        temperature: 0.2, 
        api_keys: [],
        credentials: {}
      },
      memory: parsed.memory || { type: 'file', path: './memory.json' },
      web3: parsed.web3 || { rpc_urls: {} },
      integrations: parsed.integrations || {
        telegram: { enabled: false }
      },
      permissions: parsed.permissions || {
        web3: { allow_transfer: false, allow_swap: true, max_usd_per_tx: 50 },
        system: { allow_shell_execution: false, allow_file_write: false }
      }
    } as NyxoraConfig;
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
      },
      permissions: {
        web3: { allow_transfer: false, allow_swap: true, max_usd_per_tx: 50 },
        system: { allow_shell_execution: false, allow_file_write: false }
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
