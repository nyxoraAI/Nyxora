"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installExternalSkillToolDefinition = void 0;
exports.installExternalSkill = installExternalSkill;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function installExternalSkill(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return `Failed to fetch skill from URL. Status: ${response.status}`;
        }
        const code = await response.text();
        // Extract a filename from URL, or generate a random one
        let filename = url.split('/').pop() || '';
        if (!filename.endsWith('.ts') && !filename.endsWith('.js')) {
            filename = `skill_${Date.now()}.ts`;
        }
        // Ensure external_skills directory exists
        const pluginsDir = path_1.default.join(process.cwd(), 'src', 'external_skills');
        if (!fs_1.default.existsSync(pluginsDir)) {
            fs_1.default.mkdirSync(pluginsDir, { recursive: true });
        }
        const filePath = path_1.default.join(pluginsDir, filename);
        fs_1.default.writeFileSync(filePath, code, 'utf8');
        return `Skill successfully downloaded and installed to ${filePath}. Please restart the server for the plugin manager to compile and load it.`;
    }
    catch (error) {
        return `Failed to install skill: ${error.message}`;
    }
}
exports.installExternalSkillToolDefinition = {
    type: "function",
    function: {
        name: "install_external_skill",
        description: "Downloads and installs a third-party typescript skill from a URL (e.g. GitHub Gist raw URL).",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The direct raw URL to the .ts or .js file of the skill.",
                }
            },
            required: ["url"],
        },
    },
};
