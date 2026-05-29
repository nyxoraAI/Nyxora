"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const paths_1 = require("./paths");
function loadConfig() {
    const configPath = (0, paths_1.getPath)('config.yaml');
    try {
        const file = fs_1.default.readFileSync(configPath, 'utf8');
        const parsed = yaml_1.default.parse(file);
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
        };
    }
    catch (error) {
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
function saveConfig(newConfig) {
    const configPath = (0, paths_1.getPath)('config.yaml');
    try {
        const yamlStr = yaml_1.default.stringify(newConfig);
        fs_1.default.writeFileSync(configPath, yamlStr, 'utf8');
    }
    catch (error) {
        console.error('Failed to save config.yaml', error);
    }
}
