#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const reasoning_1 = require("../agent/reasoning");
const dotenv = __importStar(require("dotenv"));
const parser_1 = require("../config/parser");
dotenv.config();
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout
});
const config = (0, parser_1.loadConfig)();
console.log(`================================`);
console.log(`🤖 OpenWeb CLI Agent Started`);
console.log(`📋 Agent Name: ${config.agent.name}`);
console.log(`🔗 Default Chain: ${config.agent.default_chain}`);
console.log(`🧠 AI Provider: ${config.llm.provider} (${config.llm.model})`);
console.log(`================================`);
console.log(`Type 'exit' or 'quit' to stop.\n`);
function ask() {
    rl.question('👤 You: ', async (input) => {
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
            console.log('Goodbye!');
            rl.close();
            return;
        }
        if (input.trim() === '') {
            ask();
            return;
        }
        console.log('🤖 Agent thinking...');
        try {
            const response = await (0, reasoning_1.processUserInput)(input);
            console.log(`\n🤖 OpenWeb: ${response}\n`);
        }
        catch (error) {
            console.log(`\n❌ Error: ${error.message}\n`);
        }
        ask();
    });
}
ask();
//# sourceMappingURL=cli.js.map