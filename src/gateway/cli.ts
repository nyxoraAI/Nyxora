#!/usr/bin/env node

import readline from 'readline';
import { processUserInput } from '../agent/reasoning';
import * as dotenv from 'dotenv';
import { loadConfig } from '../config/parser';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const config = loadConfig();

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
      const response = await processUserInput(input);
      console.log(`\n🤖 OpenWeb: ${response}\n`);
    } catch (error: any) {
      console.log(`\n❌ Error: ${error.message}\n`);
    }
    
    ask();
  });
}

ask();
