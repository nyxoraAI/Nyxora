"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeLocalFileToolDefinition = void 0;
exports.writeLocalFile = writeLocalFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function writeLocalFile(filePath, content) {
    try {
        const absolutePath = path_1.default.resolve(filePath);
        const dir = path_1.default.dirname(absolutePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(absolutePath, content, 'utf8');
        return `Success: File written to ${absolutePath}`;
    }
    catch (error) {
        return `Failed to write file: ${error.message}`;
    }
}
exports.writeLocalFileToolDefinition = {
    type: "function",
    function: {
        name: "write_local_file",
        description: "Writes or overwrites a local file on the user's computer with the provided content.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "The absolute or relative path to the file.",
                },
                content: {
                    type: "string",
                    description: "The string content to write to the file.",
                }
            },
            required: ["filePath", "content"],
        },
    },
};
