import { search, SafeSearchType } from 'duck-duck-scrape';

export async function searchWeb(query: string): Promise<string> {
  try {
    const searchResults = await search(query, {
      safeSearch: SafeSearchType.MODERATE
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      return "No results found for your query.";
    }

    // Limit to top 8 results
    const topResults = searchResults.results.slice(0, 8);
    
    let responseText = `Search Results for "${query}":\n\n`;
    
    topResults.forEach((result, index) => {
      responseText += `${index + 1}. ${result.title}\n`;
      responseText += `URL: ${result.url}\n`;
      responseText += `Snippet: ${result.description}\n\n`;
    });

    return responseText.trim();
  } catch (error: any) {
    return `Failed to search the web: ${error.message}`;
  }
}

export const searchWebToolDefinition = {
  type: "function",
  function: {
    name: "search_web",
    description: "Searches the internet for information using a search engine. Returns top titles, snippets, and URLs. Use this to find current events, documentation, or general facts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up.",
        }
      },
      required: ["query"],
    },
  },
};
