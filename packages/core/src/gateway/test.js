"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reasoning_1 = require("../agent/reasoning");
async function run() {
    console.log('🤖 Agent Test Started...');
    console.log('👤 You: Tolong cek saldo native di jaringan ethereum');
    try {
        const response = await (0, reasoning_1.processUserInput)('Tolong cek saldo native di jaringan ethereum');
        console.log(`\n🤖 Nyxora Agent: ${response}\n`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
    }
}
run();
