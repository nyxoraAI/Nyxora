import { loadConfig, loadApiKeys } from '../../config/parser';

interface SearchQueryResult {
  title: string;
  url: string;
  content: string;
}

const SEARXNG_INSTANCES = [
  'https://search.mdosch.de',
  'https://searx.tiekoetter.com',
  'https://paulgo.io',
  'https://searx.be',
  'https://searx.fmac.network'
];

async function searchTavily(query: string, apiKey: string, depth: number = 1): Promise<SearchQueryResult[]> {
  const searchDepth = depth > 1 ? 'advanced' : 'basic';
  const maxResults = depth > 1 ? 15 : 8;
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: searchDepth, max_results: maxResults })
  });
  
  if (!res.ok) {
    const status = res.status;
    throw new Error(`[Tavily Error] Status: ${status}`);
  }
  
  const json = await res.json();
  if (!json.results) return [];
  
  return json.results.map((r: any) => ({
    title: r.title,
    url: r.url,
    content: r.content
  }));
}

async function searchBrave(query: string, apiKey: string, depth: number = 1): Promise<SearchQueryResult[]> {
  const q = encodeURIComponent(query);
  const count = depth > 1 ? 15 : 8;
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=${count}`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey
    }
  });
  
  if (!res.ok) {
    const status = res.status;
    throw new Error(`[Brave Error] Status: ${status}`);
  }
  
  const json = await res.json();
  if (!json.web || !json.web.results) return [];
  
  return json.web.results.map((r: any) => ({
    title: r.title,
    url: r.url,
    content: r.description || r.title
  }));
}

async function searchSearxng(query: string, depth: number = 1): Promise<SearchQueryResult[]> {
  const q = encodeURIComponent(query);
  const maxResults = depth > 1 ? 15 : 8;
  for (const url of SEARXNG_INSTANCES) {
    try {
      const res = await fetch(`${url}/search?q=${q}&format=json`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4000)
      });
      
      if (res.ok) {
        const json = await res.json();
        if (!json.results || json.results.length === 0) continue;
        
        return json.results.slice(0, maxResults).map((r: any) => ({
          title: r.title || 'No title',
          url: r.url || '#',
          content: r.content || r.snippet || r.description || 'No description available'
        }));
      }
    } catch (e) {
      continue;
    }
  }
  throw new Error('[SearXNG Error] All decentralized instances failed.');
}

const searchCache = new Map<string, {data: SearchQueryResult[], timestamp: number}>();

export async function searchWeb(query: string, depth: number = 1): Promise<string> {
  // Auto-inject current year for time-sensitive queries
  const lowerQuery = query.toLowerCase();
  const currentYear = new Date().getFullYear().toString();
  let finalQuery = query;
  
  if ((lowerQuery.includes('hari ini') || lowerQuery.includes('sekarang') || lowerQuery.includes('today') || lowerQuery.includes('saat ini') || lowerQuery.includes('terbaru')) && !lowerQuery.includes(currentYear)) {
    finalQuery = `${query} ${currentYear}`;
    console.log(`[WebSearch] Auto-injected current year: "${finalQuery}"`);
  }

  const cacheKey = `${finalQuery.trim().toLowerCase()}_depth_${depth}`;
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 300000)) {
    console.log(`[WebSearch] Returning cached results for: "${finalQuery}" (Depth: ${depth})`);
    let responseText = `Search Results for "${query}" (Cached):\n\n`;
    cached.data.forEach((r, index) => {
      responseText += `${index + 1}. ${r.title}\n`;
      responseText += `URL: ${r.url}\n`;
      responseText += `Snippet: ${r.content}\n\n`;
    });
    return responseText.trim();
  }

  const config = loadConfig();
  const provider = config.web_search?.provider || 'mesh';
  const vaultKeys = await loadApiKeys();
  const creds = Object.keys(vaultKeys).length > 0 ? vaultKeys : (config.credentials || {});
  
  let results: SearchQueryResult[] = [];
  
  try {
    if (provider === 'tavily' && creds.tavily_key) {
      try {
        results = await searchTavily(finalQuery, creds.tavily_key, depth);
      } catch (e: any) {
        if (e.message.includes('401') || e.message.includes('429')) {
          console.warn('[WebSearch] Primary provider (Tavily) failed with 429/401. Switching to backup provider (Brave Search)...');
          if (creds.brave_key) {
            try {
              results = await searchBrave(finalQuery, creds.brave_key, depth);
            } catch (e2: any) {
              console.warn('[WebSearch] Backup provider (Brave) failed. Falling back to SearXNG Mesh...');
              results = await searchSearxng(finalQuery, depth);
            }
          } else {
            console.warn('[WebSearch] No backup provider found. Falling back to SearXNG Mesh...');
            results = await searchSearxng(finalQuery, depth);
          }
        } else {
          throw e;
        }
      }
    } else if (provider === 'brave' && creds.brave_key) {
      try {
        results = await searchBrave(finalQuery, creds.brave_key, depth);
      } catch (e: any) {
        if (e.message.includes('403') || e.message.includes('429')) {
          console.warn('[WebSearch] Primary provider (Brave) failed with 429/403. Switching to backup provider (Tavily)...');
          if (creds.tavily_key) {
            try {
              results = await searchTavily(finalQuery, creds.tavily_key, depth);
            } catch (e2: any) {
              console.warn('[WebSearch] Backup provider (Tavily) failed. Falling back to SearXNG Mesh...');
              results = await searchSearxng(finalQuery, depth);
            }
          } else {
            console.warn('[WebSearch] No backup provider found. Falling back to SearXNG Mesh...');
            results = await searchSearxng(finalQuery, depth);
          }
        } else {
          throw e;
        }
      }
    } else {
      results = await searchSearxng(finalQuery, depth);
    }
  } catch (e: any) {
    return `Failed to search the web: ${e.message}`;
  }
  
  if (results.length > 0) {
    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
  } else {
    return `Search Results for "${query}": No results found.`;
  }
  
  let responseText = `Search Results for "${query}":\n\n`;
  results.forEach((r, index) => {
    responseText += `${index + 1}. ${r.title}\n`;
    responseText += `URL: ${r.url}\n`;
    responseText += `Snippet: ${r.content}\n\n`;
  });
  
  return responseText.trim();
}

export const searchWebToolDefinition = {
  type: "function",
  function: {
    name: "search_web",
    description: "Searches the internet for information using a search engine. Returns top titles, snippets, and URLs. Use this to find current events, documentation, or general facts. If the user asks for deep/comprehensive research, pass depth: 2 or 3.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up.",
        },
        depth: {
          type: "number",
          description: "Depth of the search (1 for basic, 2 or 3 for deep comprehensive research). Default is 1.",
        }
      },
      required: ["query"],
    },
  },
};
