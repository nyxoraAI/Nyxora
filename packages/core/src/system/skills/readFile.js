"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLocalFileToolDefinition = void 0;
exports.readLocalFile = readLocalFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function readLocalFile(filePath) {
    try {
        const absolutePath = path_1.default.resolve(filePath);
        if (!fs_1.default.existsSync(absolutePath)) {
            return `Error: File not found at ${absolutePath}`;
        }
        const content = fs_1.default.readFileSync(absolutePath, 'utf8');
        return content;
    }
    catch (error) {
        return `Failed to read file: ${error.message}`;
    }
}
exports.readLocalFileToolDefinition = {
    type: "function",
    function: {
        name: "read_local_file",
        description: "Reads the content of a local file on the user's computer.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "The absolute or relative path to the file.",
                }
            },
            required: ["filePath"],
        },
    },
};
