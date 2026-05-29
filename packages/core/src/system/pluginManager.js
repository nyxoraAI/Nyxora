"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginManager = exports.PluginManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vm_1 = __importDefault(require("vm"));
class PluginManager {
    skills = new Map();
    async loadPlugins() {
        const pluginsDir = path_1.default.join(process.cwd(), 'src', 'external_skills');
        if (!fs_1.default.existsSync(pluginsDir)) {
            fs_1.default.mkdirSync(pluginsDir, { recursive: true });
            return;
        }
        const files = fs_1.default.readdirSync(pluginsDir);
        for (const file of files) {
            if (file.endsWith('.js') || file.endsWith('.ts')) {
                try {
                    const absolutePath = path_1.default.resolve(pluginsDir, file);
                    const code = fs_1.default.readFileSync(absolutePath, 'utf8');
                    // Construct a restricted require function for the sandbox
                    const restrictedRequire = (moduleName) => {
                        const blockedModules = ['fs', 'child_process', 'os', 'net', 'tls', 'cluster', 'worker_threads'];
                        if (blockedModules.includes(moduleName)) {
                            throw new Error(`Sandboxing error: Access to the '${moduleName}' module is blocked for security reasons.`);
                        }
                        // Allow fetch and other safe modules by delegating to actual require
                        return require(moduleName);
                    };
                    // Create the sandbox environment
                    const sandbox = {
                        require: restrictedRequire,
                        console: console,
                        module: { exports: {} },
                        exports: {},
                        process: { env: {} }, // Hide actual environment variables
                        Buffer: Buffer,
                        setTimeout: setTimeout,
                        clearTimeout: clearTimeout,
                        setInterval: setInterval,
                        clearInterval: clearInterval,
                    };
                    const context = vm_1.default.createContext(sandbox);
                    const script = new vm_1.default.Script(code, { filename: file });
                    // Execute the plugin code inside the VM
                    script.runInContext(context);
                    const moduleExports = sandbox.module.exports;
                    if (moduleExports.toolDefinition && moduleExports.execute) {
                        const toolName = moduleExports.toolDefinition.function.name;
                        this.skills.set(toolName, moduleExports);
                        console.log(`[PluginManager] Loaded sandboxed external skill: ${toolName}`);
                    }
                }
                catch (error) {
                    console.error(`[PluginManager] Failed to load sandboxed plugin ${file}:`, error.message);
                }
            }
        }
    }
    getToolDefinitions() {
        return Array.from(this.skills.values()).map(skill => skill.toolDefinition);
    }
    async executeTool(toolName, args) {
        const skill = this.skills.get(toolName);
        if (skill) {
            try {
                return await skill.execute(args);
            }
            catch (error) {
                return `External skill ${toolName} failed: ${error.message}`;
            }
        }
        return null; // Tool not found in external skills
    }
}
exports.PluginManager = PluginManager;
exports.pluginManager = new PluginManager();
