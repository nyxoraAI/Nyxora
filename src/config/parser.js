"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const path_1 = __importDefault(require("path"));
function loadConfig() {
    const configPath = path_1.default.resolve(process.cwd(), 'config.yaml');
    try {
        const file = fs_1.default.readFileSync(configPath, 'utf8');
        const parsed = yaml_1.default.parse(file);
        return parsed;
    }
    catch (error) {
        console.error('Failed to load config.yaml. Using default configuration.', error);
        return {
            agent: { name: 'OpenWeb-Default', default_chain: 'base' },
            llm: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.2 },
            memory: { type: 'file', path: './memory.json' }
        };
    }
}
//# sourceMappingURL=parser.js.map