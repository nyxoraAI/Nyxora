import { loadConfig } from './packages/core/src/config/parser';
import { executeWithRetry, getLLMClient } from './packages/core/src/utils/llmUtils';

async function test() {
  const config = loadConfig();
  console.log('Model:', config.llm.model);
  
  const client = await getLLMClient();
  const response = await client.chat({
    model: config.llm.model,
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 10
  });
  
  console.log('Full Response Object:', JSON.stringify(response, null, 2));
}

test().catch(console.error);
