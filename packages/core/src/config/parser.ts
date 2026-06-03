import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import { getPath } from './paths';

export async function loadApiKeys(): Promise<Record<string, string>> {
  const vaultPath = getPath('api_vault.key');
  try {
    const { Entry } = require('@napi-rs/keyring');
    const entry = new Entry('nyxora', 'api_keys');
    const data = await entry.getPassword();
    if (data) return JSON.parse(data);
  } catch (e) {
    if (fs.existsSync(vaultPath)) {
      try {
        const file = fs.readFileSync(vaultPath, 'utf8');
        return JSON.parse(file);
      } catch (err) {}
    }
  }
  return {};
}

export async function saveApiKeys(newKeys: Record<string, string>): Promise<void> {
  const vaultPath = getPath('api_vault.key');
  const currentKeys = await loadApiKeys();
  const mergedKeys = { ...currentKeys, ...newKeys };
  const dataString = JSON.stringify(mergedKeys);

  try {
    const { Entry } = require('@napi-rs/keyring');
    const entry = new Entry('nyxora', 'api_keys');
    await entry.setPassword(dataString);
  } catch (e) {
    fs.writeFileSync(vaultPath, dataString, { mode: 0o600 });
  }
}

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
    credentials?: any; // Deprecated, kept for parsing during migration
  };
  web_search?: {
    provider: 'tavily' | 'brave' | 'mesh';
    enabled: boolean;
  };
  credentials?: {
    openai_key?: string;
    gemini_key?: string;
    openrouter_key?: string;
    tavily_key?: string;
    brave_key?: string;
    [key: string]: string | undefined;
  };
  memory: {
    type: string;
    path: string;
  };
  web3?: {
    rpc_urls?: Record<string, string | string[]>;
  };
  integrations?: {
    telegram?: {
      enabled: boolean;
      bot_token?: string;
      authorized_chat_id?: number;
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
    
    // Auto-migration logic: move llm.credentials to root credentials
    let needsSave = false;
    if (parsed.llm && (parsed.llm as any).credentials) {
      if (!parsed.credentials) {
        parsed.credentials = {};
      }
      const oldCreds = (parsed.llm as any).credentials;
      Object.keys(oldCreds).forEach(key => {
        if (oldCreds[key] && !parsed.credentials![key]) {
          parsed.credentials![key] = oldCreds[key];
        }
      });
      delete (parsed.llm as any).credentials;
      needsSave = true;
    }

    if (needsSave) {
      try {
        const yamlStr = yaml.stringify(parsed);
        fs.writeFileSync(configPath, yamlStr, 'utf8');
        console.log('[Config] Auto-migrated llm.credentials to root credentials.');
      } catch (e) {
        console.error('[Config] Failed to auto-migrate config file', e);
      }
    }
    
    // Auto-migrate from config.yaml to Keyring/Vault
    if (parsed.credentials && Object.keys(parsed.credentials).length > 0) {
      const credsToMigrate = { ...parsed.credentials };
      saveApiKeys(credsToMigrate).then(() => {
        console.log('[Config] Auto-migrated API keys to secure vault.');
        delete parsed.credentials;
        try {
          const yamlStr = yaml.stringify(parsed);
          fs.writeFileSync(configPath, yamlStr, 'utf8');
        } catch (e) {}
      }).catch(e => {
        console.error('[Config] Failed to migrate API keys to secure vault', e);
      });
    }
    
    // Merge with defaults
    return {
      agent: parsed.agent || { name: 'Nyxora-Default', default_chain: 'base' },
      llm: parsed.llm || { 
        provider: 'openai', 
        model: 'gpt-4o-mini', 
        temperature: 0.2, 
        api_keys: []
      },
      web_search: parsed.web_search || {
        provider: 'mesh',
        enabled: true
      },
      credentials: parsed.credentials || {},
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
        api_keys: []
      },
      web_search: {
        provider: 'mesh',
        enabled: true
      },
      credentials: {},
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
