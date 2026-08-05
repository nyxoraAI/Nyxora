import { logger } from '../../memory/logger';

export function executeSearchMemory(query: string, limit?: number): string {
  try {
    const results = logger.searchMemoryByKeyword(query, limit || 10);
    
    if (results.length === 0) {
      return `No memories found matching the keyword: "${query}".`;
    }

    let output = `Found ${results.length} relevant memories:\n\n`;
    results.forEach((entry, idx) => {
      let contentStr = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
      // Truncate to save tokens if too long
      if (contentStr.length > 500) {
        contentStr = contentStr.substring(0, 500) + '... [TRUNCATED]';
      }
      output += `[Result ${idx + 1}] Role: ${entry.role} | Session ID: ${entry.session_id || 'Unknown'}\n`;
      output += `Content: ${contentStr}\n`;
      output += `---\n`;
    });

    return output;
  } catch (error: any) {
    return `Failed to search memory: ${error.message}`;
  }
}

export const searchMemoryToolDefinition = {
  type: "function",
  function: {
    name: "search_memory",
    description: "Search your past conversations and memories using FTS5 keyword matching. Use this to remember user preferences, past commands, or specific facts mentioned earlier across any session.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The keyword or phrase to search for. Keep it concise for better matches (e.g., 'solana wallet', 'trading strategy').",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Default is 10.",
        }
      },
      required: ["query"],
    },
  },
};
