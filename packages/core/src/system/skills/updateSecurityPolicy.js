"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSecurityPolicyToolDefinition = void 0;
exports.updateSecurityPolicy = updateSecurityPolicy;
const fs_1 = __importDefault(require("fs"));
const paths_1 = require("../../config/paths");
function updateSecurityPolicy(rule, action) {
    try {
        const policyPath = (0, paths_1.getPath)('security_policy.md');
        let existingContent = "";
        if (fs_1.default.existsSync(policyPath)) {
            existingContent = fs_1.default.readFileSync(policyPath, 'utf8');
        }
        if (action === 'clear') {
            fs_1.default.writeFileSync(policyPath, '', 'utf8');
            return "Security policy cleared.";
        }
        else if (action === 'add') {
            const newContent = existingContent + (existingContent.endsWith('\n') || existingContent === '' ? '' : '\n') + `* ${rule}`;
            fs_1.default.writeFileSync(policyPath, newContent, 'utf8');
            return `Rule added to security policy: ${rule}`;
        }
        else if (action === 'remove') {
            // Very basic line removal
            const lines = existingContent.split('\n');
            const filtered = lines.filter(l => !l.includes(rule));
            fs_1.default.writeFileSync(policyPath, filtered.join('\n'), 'utf8');
            return `Rule removed (if it existed).`;
        }
        return "Invalid action.";
    }
    catch (error) {
        return `Failed to update security policy: ${error.message}`;
    }
}
exports.updateSecurityPolicyToolDefinition = {
    type: "function",
    function: {
        name: "update_security_policy",
        description: "Updates the security_policy.md file to restrict your own autonomous behavior. Use this when the user explicitly forbids you from doing something (e.g. 'do not touch drive E').",
        parameters: {
            type: "object",
            properties: {
                rule: {
                    type: "string",
                    description: "The rule to add or remove.",
                },
                action: {
                    type: "string",
                    enum: ["add", "remove", "clear"],
                    description: "The action to perform on the policy.",
                }
            },
            required: ["rule", "action"],
        },
    },
};
