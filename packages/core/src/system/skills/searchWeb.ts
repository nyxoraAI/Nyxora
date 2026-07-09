import { loadConfig, loadApiKeys } from '../../config/parser';
import { DOMParser } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { search, SafeSearchType } from 'duck-duck-scrape';

async function scrapeUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NyxoraBot/1.0)' }, signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reader = new Readability(doc as any);
    const article = reader.parse();
    return article ? article.textContent : null;
  } catch (e) {
    return null;
  }
}

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

async function searchDuckDuckGo(query: string, depth: number = 1): Promise<SearchQueryResult[]> {
  try {
    const searchResults = await search(query, {
      safeSearch: SafeSearchType.MODERATE
    });
    
    if (!searchResults.noResults && searchResults.results.length > 0) {
      const maxResults = depth > 1 ? 15 : 8;
      return searchResults.results.slice(0, maxResults).map(r => ({
        title: r.title,
        url: r.url,
        content: r.description || r.title
      }));
    }
    return [];
  } catch (e: any) {
    throw new Error(`[DuckDuckGo Error] Failed to scrape: ${e.message}`);
  }
}

const searchCache = new Map<string, {data: SearchQueryResult[], timestamp: number}>();

async function searchSerpApi(query: string, apiKey: string, depth: number = 1): Promise<SearchQueryResult[]> {
  const q = encodeURIComponent(query);
  const num = depth > 1 ? 15 : 8;
  const res = await fetch(`https://serpapi.com/search?engine=google&q=${q}&api_key=${apiKey}&num=${num}`);
  
  if (!res.ok) {
    throw new Error(`[SerpApi Error] Status: ${res.status}`);
  }
  
  const json = await res.json();
  const results: SearchQueryResult[] = [];

  if (json.answer_box && json.answer_box.snippet) {
    results.push({
      title: json.answer_box.title || "Direct Answer",
      url: json.answer_box.link || "#",
      content: json.answer_box.snippet
    });
  }

  if (json.organic_results) {
    for (const r of json.organic_results) {
      results.push({
        title: r.title || "No title",
        url: r.link || "#",
        content: r.snippet || r.title
      });
    }
  }

  return results;
}

export async function searchWeb(query: string, depth: number = 1): Promise<string> {
  // Auto-inject current year for time-sensitive queries
  const lowerQuery = String(query || "").toLowerCase();
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
  const creds = { ...(config.credentials || {}), ...vaultKeys };
  
  let results: SearchQueryResult[] = [];
  
  try {
    if (provider === 'serpapi' && creds.serpapi_key) {
      try {
        console.log(`[WebSearch] Executing search via SerpApi for: "${finalQuery}"`);
        results = await searchSerpApi(finalQuery, creds.serpapi_key, depth);
      } catch (e: any) {
        console.warn(`[WebSearch] Primary provider (SerpApi) failed: ${e.message}. Switching to backup provider (DuckDuckGo)...`);
        try {
          results = await searchDuckDuckGo(finalQuery, depth);
        } catch (e3) {
          console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
          results = await searchSearxng(finalQuery, depth);
        }
      }
    } else if (provider === 'tavily' && creds.tavily_key) {
      try {
        results = await searchTavily(finalQuery, creds.tavily_key, depth);
      } catch (e: any) {
        if (e.message.includes('401') || e.message.includes('429')) {
          console.warn('[WebSearch] Primary provider (Tavily) failed with 429/401. Switching to backup provider (Brave Search)...');
          if (creds.brave_key) {
            try {
              results = await searchBrave(finalQuery, creds.brave_key, depth);
            } catch (e2: any) {
              console.warn('[WebSearch] Backup provider (Brave) failed. Falling back to DuckDuckGo (L3)...');
              try {
                results = await searchDuckDuckGo(finalQuery, depth);
              } catch (e3) {
                console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
                results = await searchSearxng(finalQuery, depth);
              }
            }
          } else {
            console.warn('[WebSearch] No backup premium provider found. Falling back to DuckDuckGo (L3)...');
            try {
              results = await searchDuckDuckGo(finalQuery, depth);
            } catch (e3) {
              console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
              results = await searchSearxng(finalQuery, depth);
            }
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
              console.warn('[WebSearch] Backup provider (Tavily) failed. Falling back to DuckDuckGo (L3)...');
              try {
                results = await searchDuckDuckGo(finalQuery, depth);
              } catch (e3) {
                console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
                results = await searchSearxng(finalQuery, depth);
              }
            }
          } else {
            console.warn('[WebSearch] No backup premium provider found. Falling back to DuckDuckGo (L3)...');
            try {
              results = await searchDuckDuckGo(finalQuery, depth);
            } catch (e3) {
              console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
              results = await searchSearxng(finalQuery, depth);
            }
          }
        } else {
          throw e;
        }
      }
    } else if (provider === 'duckduckgo') {
      try {
        results = await searchDuckDuckGo(finalQuery, depth);
      } catch (e: any) {
        console.warn('[WebSearch] Primary provider (DuckDuckGo) failed. Falling back to SearXNG Mesh...');
        results = await searchSearxng(finalQuery, depth);
      }
    } else {
      // Default 'mesh' provider - Prioritize DuckDuckGo as it's more reliable than public SearXNG instances
      try {
        results = await searchDuckDuckGo(finalQuery, depth);
      } catch (e: any) {
        console.warn('[WebSearch] Mesh: DuckDuckGo failed. Falling back to SearXNG...');
        results = await searchSearxng(finalQuery, depth);
      }
    }
  } catch (e: any) {
    return `[Search Failed] The web search failed due to an error: ${e.message}. CRITICAL INSTRUCTION: You MUST inform the user that the web search failed. Do NOT hallucinate or guess the answer.`;
  }
  
  if (results.length > 0) {
    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
  } else {
    return `Search Results for "${query}": No results found.`;
  }
  
  let responseText = `Search Results for "${query}":\n\n`;
  for (let index = 0; index < results.length; index++) {
    const r = results[index];
    responseText += `${index + 1}. ${r.title}\n`;
    responseText += `URL: ${r.url}\n`;
    
    if (depth > 1 && index < 3) {
      const fullText = await scrapeUrl(r.url);
      if (fullText) {
        responseText += `Extracted Content: ${fullText.replace(/\\s+/g, ' ').substring(0, 1500)}...\n\n`;
        continue;
      }
    }
    responseText += `Snippet: ${r.content}\n\n`;
  }
  
  return responseText.trim();
}

export const searchWebToolDefinition = {
  type: "function",
  function: {
    name: "search_web",
    description: "Searches the internet for information using a search engine. Returns top titles, snippets, and URLs. CRITICAL: If the user asks for news, sports scores, current events, or factual dates, you MUST set depth: 2 to extract the full article content. Do not use depth 1 for facts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The highly optimized search query to look up (translate to English for global events).",
        },
        depth: {
          type: "number",
          description: "Depth of the search (1 for basic snippets, 2 for deep scraping of top 3 sites). MUST be 2 for news/scores/facts.",
        }
      },
      required: ["query"],
    },
  },
};
