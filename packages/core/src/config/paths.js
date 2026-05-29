"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppDir = getAppDir;
exports.getPath = getPath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
let isGlobalModeCache = null;
function getAppDir() {
    // Check if .env or config.yaml exists in current working directory
    if (isGlobalModeCache === null) {
        const localEnv = path_1.default.join(process.cwd(), '.env');
        const localConfig = path_1.default.join(process.cwd(), 'config.yaml');
        if (fs_1.default.existsSync(localEnv) || fs_1.default.existsSync(localConfig)) {
            isGlobalModeCache = false; // Local manual mode
        }
        else {
            isGlobalModeCache = true; // Global CLI mode
        }
    }
    if (isGlobalModeCache) {
        const globalDir = path_1.default.join(os_1.default.homedir(), '.nyxora');
        if (!fs_1.default.existsSync(globalDir)) {
            fs_1.default.mkdirSync(globalDir, { recursive: true });
        }
        return globalDir;
    }
    return process.cwd();
}
function getPath(filename) {
    return path_1.default.join(getAppDir(), filename);
}
