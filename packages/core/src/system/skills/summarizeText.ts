import { getLLMClient } from '../../utils/llmUtils';
import { loadConfig } from '../../config/parser';

export async function summarizeText(text: string, focus?: string): Promise<string> {
  try {
    const client = await getLLMClient();
    const config = loadConfig();
    const model = config.llm.model || 'gpt-4o-mini';
    
    // Chunking text if it's too long (simplified chunking for demonstration)
    const maxLength = 60000; // rough char limit
    const contentToSummarize = text.length > maxLength ? text.substring(0, maxLength) + "... [Truncated]" : text;
    
    let systemPrompt = "You are an expert summarizer for a Web3 AI Agent. Provide a concise, bulleted summary of the provided text.";
    if (focus) {
      systemPrompt += ` Focus the summary specifically on: ${focus}`;
    }

    const response = await client.chat({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentToSummarize }
      ],
      temperature: 0.3,
    });

    return `Summary:\n${response.message.content || "No summary generated."}`;
  } catch (error: any) {
    return `Failed to summarize text: ${error.message}`;
  }
}

export const summarizeTextToolDefinition = {
  type: "function",
  function: {
    name: "summarize_text",
    description: "Summarizes extremely long texts or articles. Use this when you have scraped a long document or web page and need its core insights.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The long text to be summarized.",
        },
        focus: {
          type: "string",
          description: "Optional. Specific aspect to focus the summary on (e.g., 'Tokenomics', 'Vulnerabilities', 'Action Items').",
        }
      },
      required: ["text"],
    },
  },
};
