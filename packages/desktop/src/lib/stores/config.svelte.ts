import { apiFetch } from '$lib/utils/api';

export interface NyxoraConfig {
  agent: {
    name: string;
    description: string;
    default_chain: string;
    default_router?: string;
    default_slippage?: number | "auto";
    log_level?: 'info' | 'debug';
    base_fiat?: string;
    python_path?: string;
  };
  llm: {
    provider: string;
    model: string;
    temperature: number;
    reasoning_effort?: 'low' | 'medium' | 'high' | 'none';
    api_keys?: string[];
    base_url?: string;
    image_provider?: string;
    image_model?: string;
  };
  web_search?: {
    provider: 'tavily' | 'brave' | 'duckduckgo' | 'mesh' | 'serpapi';
    enabled: boolean;
  };
  credentials?: Record<string, string | undefined>;
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
    discord?: {
      enabled: boolean;
      bot_token?: string;
      client_id?: string;
    };
  };
  security?: {
    dashboard_password?: string;
  };
  skills?: {
    web3: string[];
    os: string[];
  };
  channels?: {
    active: string[];
  };
}

export interface PolicyConfig {
  max_usd_per_tx?: number;
  whitelist_only?: boolean;
  require_approval?: boolean;
  auto_approve_limit_usd?: number;
  custom_llm_rules?: string[];
}

export interface UserProfile {
  risk_level: string;
  max_slippage: number;
  avoid_memecoins: boolean;
}

function createConfigStore() {
  let config = $state<NyxoraConfig | null>(null);
  let policy = $state<PolicyConfig | null>(null);
  let profile = $state<UserProfile | null>(null);
  let isLoading = $state(false);
  let isSaving = $state(false);

  return {
    get config() { return config; },
    get policy() { return policy; },
    get profile() { return profile; },
    get isLoading() { return isLoading; },
    get isSaving() { return isSaving; },
    
    async load() {
      isLoading = true;
      try {
        const [configRes, policyRes, profileRes] = await Promise.all([
          apiFetch('/api/config'),
          apiFetch('/api/policy'),
          apiFetch('/api/profile')
        ]);
        
        if (configRes.ok) config = await configRes.json();
        if (policyRes.ok) policy = await policyRes.json();
        if (profileRes.ok) profile = await profileRes.json();
      } catch (e) {
        console.error('Failed to load configuration:', e);
      } finally {
        isLoading = false;
      }
    },
    
    async saveAll() {
      if (!config || !policy || !profile) return;
      isSaving = true;
      try {
        await Promise.all([
          apiFetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          }),
          apiFetch('/api/policy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(policy)
          }),
          apiFetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
          })
        ]);
      } catch (e) {
        console.error('Failed to save settings:', e);
        this.load();
      } finally {
        isSaving = false;
      }
    },
    
    updateConfig(newConfig: Partial<NyxoraConfig>) {
      if (!config) return;
      config = { ...config, ...newConfig } as NyxoraConfig;
    },
    
    updatePolicy(newPolicy: Partial<PolicyConfig>) {
      if (!policy) return;
      policy = { ...policy, ...newPolicy } as PolicyConfig;
    },
    
    updateProfile(newProfile: Partial<UserProfile>) {
      if (!profile) return;
      profile = { ...profile, ...newProfile } as UserProfile;
    }
  };
}

export const configStore = createConfigStore();
