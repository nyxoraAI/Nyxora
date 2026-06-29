import { executeWithRetry } from './packages/core/src/utils/llmUtils';
import { loadConfig } from './packages/core/src/config/parser';

async function test() {
  const config = loadConfig();
  const inputs = [
    'swap 0.0001 eth sepolia ke usdc',
    'tf 10 usdc ke 0x123',
    'baca email hari ini'
  ];
  
  const routerPrompt = `You are Nyxora's Semantic Intent Router. Your job is to classify the user's FINAL message into one of three categories: 'web3', 'os', or 'general'.
Rules:
1. FOCUS ONLY ON THE FINAL MESSAGE. History is only for context.
2. The user may speak in ANY language, including casual slang, idioms, or abbreviations (e.g., 'tf', 'wd', 'buy', 'sell'). Translate their core intent logically.
3. If the core intent involves blockchain, crypto, bridging, swapping, trading, sending/receiving, tokens, wallets, or transactions, reply 'web3'.
4. If the core intent involves OS automation, web search, weather, emails, files, terminal, or changing AI settings, reply 'os'.
5. If it is purely casual conversation, chit-chat, or greetings, reply 'general'.
Reply with EXACTLY ONE WORD: web3, os, or general.`;

  for (const input of inputs) {
    const routerMessages = [
        { role: 'system', content: routerPrompt },
        { role: 'user', content: input }
    ];

    try {
      const routerResponse = await executeWithRetry(async (client) => {
          return await client.chat({
              model: config.llm.model,
              messages: routerMessages as any,
              temperature: 0.1,
              max_tokens: 500
          });
      });
      
      console.log(`Input: ${input} => Result: ${routerResponse.message.content}`);
    } catch (e) {
      console.error(`Input: ${input} => Error:`, e);
    }
  }
}
test();
