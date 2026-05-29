import { processUserInput } from '../agent/reasoning';
import { startTelegramBot } from './telegram';
import { getPath } from '../config/paths';

async function run() {
  console.log('🤖 Agent Test Started...');
  console.log('👤 You: Tolong cek saldo native di jaringan ethereum');
  try {
    const response = await processUserInput('Tolong cek saldo native di jaringan ethereum');
    console.log(`\n🤖 Nyxora Agent: ${response}\n`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

run();
