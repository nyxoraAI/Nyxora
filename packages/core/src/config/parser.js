"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptDataSync = encryptDataSync;
exports.decryptDataSync = decryptDataSync;
exports.loadRpcConfig = loadRpcConfig;
exports.saveRpcConfig = saveRpcConfig;
exports.loadApiKeys = loadApiKeys;
exports.saveApiKeys = saveApiKeys;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.loadPolicyConfig = loadPolicyConfig;
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const paths_1 = require("./paths");
let cachedEncryptionKey = null;
function getEncryptionKeySync() {
    if (cachedEncryptionKey)
        return cachedEncryptionKey;
    let masterKeyRaw = process.env.NYXORA_MASTER_KEY;
    if (!masterKeyRaw) {
        try {
            const { execSync } = require('child_process');
            const output = execSync(`node -e "require('@napi-rs/keyring').Entry.prototype.getPassword.call(new (require('@napi-rs/keyring').Entry)('nyxora', 'config_master')).then(console.log).catch(()=>console.log(''))"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
            const pk = output?.trim();
            if (pk)
                masterKeyRaw = pk;
        }
        catch { }
    }
    if (!masterKeyRaw) {
        try {
            const masterKeyPath = path_1.default.join(os_1.default.homedir(), '.nyxora', 'auth', 'master.key');
            if (fs_1.default.existsSync(masterKeyPath)) {
                masterKeyRaw = fs_1.default.readFileSync(masterKeyPath, 'utf8').trim();
            }
            else {
                masterKeyRaw = crypto_1.default.randomBytes(32).toString('hex');
                try {
                    fs_1.default.writeFileSync(masterKeyPath, masterKeyRaw, { mode: 0o600 });
                }
                catch { }
            }
        }
        catch (e) {
            masterKeyRaw = 'default_fallback_nyxora_key';
        }
    }
    cachedEncryptionKey = crypto_1.default.createHash('sha256').update(masterKeyRaw).digest();
    return cachedEncryptionKey;
}
function encryptDataSync(text) {
    if (!text || text.startsWith('ENC:'))
        return text;
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', getEncryptionKeySync(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `ENC:${iv.toString('hex')}:${authTag}:${encrypted}`;
}
function decryptDataSync(encryptedText) {
    if (!encryptedText)
        return encryptedText;
    if (!encryptedText.startsWith('ENC:')) {
        return encryptedText;
    }
    try {
        const parts = encryptedText.split(':');
        if (parts.length < 4)
            return encryptedText;
        const iv = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');
        const encrypted = parts.slice(3).join(':');
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', getEncryptionKeySync(), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (e) {
        return encryptedText; // return raw if decryption fails
    }
}
function loadRpcConfig() {
    const rpcPath = (0, paths_1.getPath)('rpc_key.yaml');
    if (fs_1.default.existsSync(rpcPath)) {
        try {
            return yaml_1.default.parse(fs_1.default.readFileSync(rpcPath, 'utf8')) || {};
        }
        catch (e) {
            console.error('[Config] Failed to parse rpc_key.yaml', e);
        }
    }
    return {};
}
function saveRpcConfig(rpcUrls) {
    const rpcPath = (0, paths_1.getPath)('rpc_key.yaml');
    try {
        const tempPath = rpcPath + '.tmp.' + Date.now();
        fs_1.default.writeFileSync(tempPath, yaml_1.default.stringify(rpcUrls), 'utf8');
        fs_1.default.renameSync(tempPath, rpcPath);
    }
    catch (error) {
        console.error('Failed to save rpc_key.yaml', error);
    }
}
async function loadApiKeys() {
    const config = loadConfig();
    return config.credentials || {};
}
async function saveApiKeys(newKeys) {
    const config = loadConfig();
    if (!config.credentials)
        config.credentials = {};
    config.credentials = { ...config.credentials, ...newKeys };
    saveConfig(config);
}
let cachedNyxoraConfig = null;
let lastConfigLoadTime = 0;
function loadConfig() {
    const now = Date.now();
    if (cachedNyxoraConfig && now - lastConfigLoadTime < 5000) {
        return cachedNyxoraConfig;
    }
    const configPath = (0, paths_1.getPath)('config.yaml');
    const rpcPath = (0, paths_1.getPath)('rpc_key.yaml');
    let rpcUrls = loadRpcConfig();
    try {
        const file = fs_1.default.readFileSync(configPath, 'utf8');
        const parsed = yaml_1.default.parse(file);
        let needsSave = false;
        // Decrypt credentials
        if (parsed.credentials) {
            for (const key in parsed.credentials) {
                if (parsed.credentials[key]) {
                    if (parsed.credentials[key].startsWith('ENC:'))
                        needsSave = true;
                    parsed.credentials[key] = decryptDataSync(parsed.credentials[key]);
                }
            }
        }
        if (parsed.integrations?.telegram?.bot_token) {
            if (parsed.integrations.telegram.bot_token.startsWith('ENC:'))
                needsSave = true;
            parsed.integrations.telegram.bot_token = decryptDataSync(parsed.integrations.telegram.bot_token);
        }
        // Auto-migration logic: move llm.credentials to root credentials
        if (parsed.llm && parsed.llm.credentials) {
            if (!parsed.credentials) {
                parsed.credentials = {};
            }
            const oldCreds = parsed.llm.credentials;
            Object.keys(oldCreds).forEach(key => {
                if (oldCreds[key] && !parsed.credentials[key]) {
                    parsed.credentials[key] = oldCreds[key];
                }
            });
            delete parsed.llm.credentials;
            needsSave = true;
        }
        // Ensure we don't accidentally overwrite rpc_key.yaml with old config.yaml data.
        if (parsed.web3 && parsed.web3.rpc_urls) {
            delete parsed.web3.rpc_urls;
            needsSave = true;
        }
        // Auto-migration logic: move permissions to policy.yaml
        const policyPath = (0, paths_1.getPath)('policy.yaml');
        if (!fs_1.default.existsSync(policyPath)) {
            const defaultPolicy = `auto_approve_limit_usd: 0\ncustom_llm_rules: []\n`;
            fs_1.default.writeFileSync(policyPath, defaultPolicy, 'utf8');
            console.log('[Config] Created default policy.yaml.');
        }
        if (parsed.permissions) {
            delete parsed.permissions;
            needsSave = true;
        }
        if (needsSave) {
            try {
                saveConfig(parsed);
                console.log('[Config] Auto-migrated config file safely.');
            }
            catch (e) {
                console.error('[Config] Failed to auto-migrate config file', e);
            }
        }
        const validatedConfig = {
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
            web3: { ...parsed.web3, rpc_urls: rpcUrls },
            integrations: parsed.integrations || {
                telegram: { enabled: false },
                discord: { enabled: false }
            },
            security: parsed.security || { dashboard_password: '123456' },
            skills: parsed.skills,
            channels: parsed.channels
        };
        cachedNyxoraConfig = validatedConfig;
        lastConfigLoadTime = Date.now();
        return validatedConfig;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Config] No config.yaml found. Using default configuration.');
        }
        else if (error.name === 'YAMLError' || error.message?.includes('YAML')) {
            console.warn('[Parser] YAML Parse Error:', error.message);
        }
        else {
            console.error('[Config] Failed to load config.yaml. Using default configuration.', error);
        }
        const defaultConfig = {
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
            web3: { rpc_urls: rpcUrls },
            integrations: {
                telegram: { enabled: false },
                discord: { enabled: false }
            }
        };
        cachedNyxoraConfig = defaultConfig;
        lastConfigLoadTime = Date.now();
        return defaultConfig;
    }
}
function saveConfig(newConfig) {
    const configPath = (0, paths_1.getPath)('config.yaml');
    try {
        cachedNyxoraConfig = null;
        lastConfigLoadTime = 0;
        const configToSave = JSON.parse(JSON.stringify(newConfig));
        if (configToSave.web3 && configToSave.web3.rpc_urls) {
            delete configToSave.web3.rpc_urls;
        }
        // Keys are no longer encrypted before saving. They are stored in plain text.
        const yamlStr = yaml_1.default.stringify(configToSave);
        const tempPath = configPath + '.tmp.' + Date.now();
        fs_1.default.writeFileSync(tempPath, yamlStr, 'utf8');
        fs_1.default.renameSync(tempPath, configPath);
    }
    catch (error) {
        console.error('Failed to save config.yaml', error);
    }
}
function loadPolicyConfig() {
    const policyPath = (0, paths_1.getPath)('policy.yaml');
    if (fs_1.default.existsSync(policyPath)) {
        try {
            return yaml_1.default.parse(fs_1.default.readFileSync(policyPath, 'utf8')) || {};
        }
        catch (e) {
            console.error('[Config] Failed to parse policy.yaml', e);
        }
    }
    return {};
}
