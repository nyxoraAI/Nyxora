"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const parser_1 = require("../config/parser");
class Logger {
    logFilePath;
    memory = [];
    constructor() {
        const config = (0, parser_1.loadConfig)();
        this.logFilePath = path_1.default.resolve(process.cwd(), config.memory.path || 'memory.json');
        this.loadMemory();
    }
    loadMemory() {
        if (fs_1.default.existsSync(this.logFilePath)) {
            try {
                const data = fs_1.default.readFileSync(this.logFilePath, 'utf-8');
                this.memory = JSON.parse(data);
            }
            catch (error) {
                console.error('Failed to read memory file. Starting fresh.');
                this.memory = [];
            }
        }
    }
    saveMemory() {
        try {
            fs_1.default.writeFileSync(this.logFilePath, JSON.stringify(this.memory, null, 2));
        }
        catch (error) {
            console.error('Failed to write memory file.');
        }
    }
    getHistory() {
        return [...this.memory];
    }
    addEntry(entry) {
        this.memory.push(entry);
        this.saveMemory();
    }
    clear() {
        this.memory = [];
        this.saveMemory();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map