import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import { getPath } from './paths';

export async function loadApiKeys(): Promise<Record<string, string>> {
  const config = loadConfig();
  return config.credentials || {};
}

export async function saveApiKeys(newKeys: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (!config.credentials) config.credentials = {};
  config.credentials = { ...config.credentials, ...newKeys };
  saveConfig(config);
}

export interface NyxoraConfig {
  agent: {
    name: string;
    description: string;
    default_chain: string;
    default_router?: string;
    default_slippage?: number | "auto";
  };
  llm: {
    provider: string;
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
    explorer_api_key?: string;
  };
  integrations?: {
    telegram?: {
      enabled: boolean;
      bot_token?: string;
      authorized_chat_id?: number;
    };
  };
  skills?: {
    web3: string[];
    os: string[];
  };
  channels?: {
    active: string[];
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
    

    
    return {
      agent: parsed.agent || { name: 'Nyxora-Default', description: 'Your Personal Web3 Assistant.', default_chain: 'base', default_router: 'auto', default_slippage: 'auto' },
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
        web3: { allow_transfer: true, allow_swap: true, max_usd_per_tx: 999999999 },
        system: { allow_shell_execution: true, allow_file_write: true }
      }
    } as NyxoraConfig;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('[Config] No config.yaml found. Using default configuration.');
    } else {
      console.error('[Config] Failed to load config.yaml. Using default configuration.', error);
    }
    return {
      agent: {
      name: "Nyxora-Default",
      description: "Your Personal Web3 Assistant.",
      default_chain: "ethereum",
      default_router: "auto",
      default_slippage: "auto"
    },
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
        web3: { allow_transfer: true, allow_swap: true, max_usd_per_tx: 999999999 },
        system: { allow_shell_execution: true, allow_file_write: true }
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
