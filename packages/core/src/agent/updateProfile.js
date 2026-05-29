"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileToolDefinition = void 0;
exports.updateProfile = updateProfile;
const fs_1 = __importDefault(require("fs"));
const paths_1 = require("../config/paths");
function updateProfile(content, mode) {
    try {
        const userMdPath = (0, paths_1.getPath)('user.md');
        if (mode === 'replace') {
            fs_1.default.writeFileSync(userMdPath, content, 'utf8');
            return "Profile replaced successfully. New user.md has been saved.";
        }
        else {
            let existingContent = "";
            if (fs_1.default.existsSync(userMdPath)) {
                existingContent = fs_1.default.readFileSync(userMdPath, 'utf8');
            }
            const newContent = existingContent + "\n" + content;
            fs_1.default.writeFileSync(userMdPath, newContent, 'utf8');
            return "Profile appended successfully. New instructions added to user.md.";
        }
    }
    catch (error) {
        return `Failed to update profile: ${error.message}`;
    }
}
exports.updateProfileToolDefinition = {
    type: "function",
    function: {
        name: "update_profile",
        description: "Updates or rewrites the user.md file. Use this when the user asks you to remember something about them, change their persona, or update your instructions.",
        parameters: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "The content to write or append to user.md",
                },
                mode: {
                    type: "string",
                    enum: ["append", "replace"],
                    description: "Whether to append the content to the existing file or replace the entire file.",
                }
            },
            required: ["content", "mode"],
        },
    },
};
