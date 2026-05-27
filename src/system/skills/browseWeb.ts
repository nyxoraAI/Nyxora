export async function browseWebsite(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Nyxora/1.0',
      }
    });
    
    if (!response.ok) {
      return `Error: Failed to fetch URL, Status: ${response.status} ${response.statusText}`;
    }
    
    const html = await response.text();
    // A very basic HTML to text stripping to avoid exceeding context limits
    // In a production app, we would use cheerio or puppeteer.
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
      
    // Limit to first 20000 characters to prevent context overflow
    if (text.length > 20000) {
      return text.substring(0, 20000) + "... [Content Truncated]";
    }
    
    return text;
  } catch (error: any) {
    return `Failed to browse website: ${error.message}`;
  }
}

export const browseWebsiteToolDefinition = {
  type: "function",
  function: {
    name: "browse_website",
    description: "Fetches and reads the textual content of a webpage.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to read.",
        }
      },
      required: ["url"],
    },
  },
};
