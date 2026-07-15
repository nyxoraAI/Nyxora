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

export async function searchWeb(query: string, depth: number = 2): Promise<string> {
  const now = new Date();
  const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // English date string works best for search engine queries regardless of user locale
  const currentDateEn = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  // ISO date for unambiguous filtering
  const currentDateISO = now.toISOString().split('T')[0]; // e.g. 2026-07-11
  const currentYear    = now.getFullYear().toString();

  const lowerQuery = String(query || '').toLowerCase();
  let finalQuery = query;

  // Detect time-sensitive queries across multiple languages
  const isTimeSensitive =
    // Indonesian — common + missing words that caused hallucination
    lowerQuery.includes('hari ini') ||
    lowerQuery.includes('sekarang') ||
    lowerQuery.includes('saat ini') ||
    lowerQuery.includes('terbaru') ||
    lowerQuery.includes('terkini') ||
    lowerQuery.includes('tadi') ||        // "tadi malam", "tadi pagi", "tadi" alone
    lowerQuery.includes('kemarin') ||     // "kemarin"
    lowerQuery.includes('besok') ||       // "besok"
    lowerQuery.includes('malam ini') ||   // "malam ini"
    lowerQuery.includes('pagi ini') ||    // "pagi ini"
    lowerQuery.includes('sore ini') ||    // "sore ini"
    lowerQuery.includes('minggu ini') ||  // "minggu ini"
    lowerQuery.includes('bulan ini') ||   // "bulan ini"
    lowerQuery.includes('baru saja') ||   // "baru saja"
    lowerQuery.includes('baru aja') ||    // "baru aja"
    lowerQuery.includes('habis') ||       // "habis main", "habis selesai"
    lowerQuery.includes('sudah selesai') ||
    lowerQuery.includes('udah selesai') ||
    // English
    lowerQuery.includes('today') ||
    lowerQuery.includes('latest') ||
    lowerQuery.includes('current') ||
    lowerQuery.includes('live') ||
    lowerQuery.includes('right now') ||
    lowerQuery.includes('just now') ||
    lowerQuery.includes('yesterday') ||
    lowerQuery.includes('tomorrow') ||
    lowerQuery.includes('this week') ||
    lowerQuery.includes('this month') ||
    lowerQuery.includes('recent') ||
    lowerQuery.includes('breaking') ||
    // Spanish
    lowerQuery.includes('hoy') ||
    lowerQuery.includes('ahora') ||
    // French
    lowerQuery.includes("aujourd'hui") ||
    // German
    lowerQuery.includes('heute') ||
    // Japanese
    lowerQuery.includes('今日') ||
    lowerQuery.includes('現在') ||
    // Korean
    lowerQuery.includes('오늘') ||
    // Chinese
    lowerQuery.includes('今天') ||
    lowerQuery.includes('现在');

  // ── Detect specific context/round that user is asking about ────────────────
  // This prevents the LLM from mixing results across tournament stages, news
  // categories, etc. e.g. "semifinal" results vs "quarterfinal" results.
  type ContextCategory = 'tournament_round' | 'match_specific' | 'standings' | 'schedule' | null;
  let detectedContext: string | null = null;
  let detectedContextCategory: ContextCategory = null;

  // Tournament rounds
  if (/semifinal|semi final|semi-final|4 besar|empat besar/i.test(lowerQuery)) {
    detectedContext = 'semifinal';
    detectedContextCategory = 'tournament_round';
  } else if (/final\b|the final|partai final|babak final/i.test(lowerQuery)) {
    detectedContext = 'final';
    detectedContextCategory = 'tournament_round';
  } else if (/quarter.?final|perempat final|8 besar|delapan besar/i.test(lowerQuery)) {
    detectedContext = 'quarterfinal';
    detectedContextCategory = 'tournament_round';
  } else if (/round of 16|babak 16 besar|16 besar|last 16/i.test(lowerQuery)) {
    detectedContext = 'round of 16';
    detectedContextCategory = 'tournament_round';
  } else if (/group stage|babak grup|fase grup/i.test(lowerQuery)) {
    detectedContext = 'group stage';
    detectedContextCategory = 'tournament_round';
  } else if (/klasemen|standings|table/i.test(lowerQuery)) {
    detectedContext = 'standings';
    detectedContextCategory = 'standings';
  } else if (/jadwal|schedule|fixture/i.test(lowerQuery)) {
    detectedContext = 'schedule';
    detectedContextCategory = 'schedule';
  }

  // Detect factual queries that need deep search regardless of temporal markers
  // (sports scores, news, journals, financial data, etc.)
  const isFactualQuery =
    // Sports
    lowerQuery.includes('skor') || lowerQuery.includes('score') ||
    lowerQuery.includes('hasil') || lowerQuery.includes('result') ||
    lowerQuery.includes('pertandingan') || lowerQuery.includes('match') ||
    lowerQuery.includes('piala') || lowerQuery.includes('final') ||
    lowerQuery.includes('semifinal') || lowerQuery.includes('liga') ||
    lowerQuery.includes('tournament') || lowerQuery.includes('klasemen') ||
    // News
    lowerQuery.includes('berita') || lowerQuery.includes('news') ||
    lowerQuery.includes('kejadian') || lowerQuery.includes('peristiwa') ||
    // Journals / Research
    lowerQuery.includes('jurnal') || lowerQuery.includes('journal') ||
    lowerQuery.includes('penelitian') || lowerQuery.includes('research') ||
    lowerQuery.includes('paper') || lowerQuery.includes('study') ||
    lowerQuery.includes('studi') ||
    // Finance
    lowerQuery.includes('harga') || lowerQuery.includes('price') ||
    lowerQuery.includes('saham') || lowerQuery.includes('stock') ||
    lowerQuery.includes('inflasi') || lowerQuery.includes('inflation');

  // Force depth=2 for factual queries to get full article content
  const effectiveDepth = (isTimeSensitive || isFactualQuery) ? Math.max(depth, 2) : depth;
  if (effectiveDepth > depth) {
    console.log(`[WebSearch] Auto-upgraded to depth=2 for factual/temporal query: "${query}"`);
  }

  if (isTimeSensitive) {
    // Replace time-relative words with the actual English date for the search engine.
    // English date format works universally across all search providers.
    finalQuery = query
      // Indonesian
      .replace(/hari ini/gi, currentDateEn)
      .replace(/sekarang/gi, currentDateEn)
      .replace(/saat ini/gi, currentDateEn)
      .replace(/\btadi\b/gi, currentDateEn)       // "hasil tadi" → "hasil July 15, 2026"
      .replace(/kemarin/gi, (() => {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      })())
      .replace(/besok/gi, (() => {
        const d = new Date(now); d.setDate(d.getDate() + 1);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      })())
      .replace(/malam ini/gi, currentDateEn)
      .replace(/pagi ini/gi, currentDateEn)
      .replace(/sore ini/gi, currentDateEn)
      // English
      .replace(/\btoday\b/gi, currentDateEn)
      .replace(/\byesterday\b/gi, (() => {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      })())
      .replace(/\btomorrow\b/gi, (() => {
        const d = new Date(now); d.setDate(d.getDate() + 1);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      })())
      // Spanish
      .replace(/\bhoy\b/gi, currentDateEn)
      // French
      .replace(/aujourd'hui/gi, currentDateEn)
      // German
      .replace(/\bheute\b/gi, currentDateEn)
      // Japanese
      .replace(/今日/g, currentDateEn)
      // Korean
      .replace(/오늘/g, currentDateEn)
      // Chinese
      .replace(/今天/g, currentDateEn);

    // Append the date if it wasn't substituted in (e.g. for "terbaru", "latest", "habis")
    if (!finalQuery.includes(currentYear)) finalQuery += ` ${currentDateEn}`;
    console.log(`[WebSearch] Temporal injection (tz: ${tz}): "${query}" → "${finalQuery}"`);
  }

  // ── Reinforce context-specific terms in query ─────────────────────────────
  // If user asked about a specific round (semifinal, final, etc.), make sure
  // the query sent to the search engine explicitly targets that round.
  // This prevents search engines from returning results from other rounds.
  if (detectedContext && isTimeSensitive) {
    // Only reinforce if the query doesn't already have the exact English term
    const hasExactTerm = finalQuery.toLowerCase().includes(detectedContext);
    if (!hasExactTerm) {
      finalQuery = `${finalQuery} ${detectedContext}`;
    }
    // Also append date for specificity
    if (!finalQuery.includes(currentYear)) finalQuery += ` ${currentDateEn}`;
    console.log(`[WebSearch] Context reinforcement [${detectedContext}]: "${query}" → "${finalQuery}"`);
  } else if (detectedContext && !isTimeSensitive) {
    // Factual query with context but no temporal signal — still reinforce context
    const hasExactTerm = finalQuery.toLowerCase().includes(detectedContext);
    if (!hasExactTerm) finalQuery = `${finalQuery} ${detectedContext}`;
  }

  const cacheKey = `${finalQuery.trim().toLowerCase()}_depth_${effectiveDepth}`;
  const cached = searchCache.get(cacheKey);
  // Short TTL for time-sensitive queries, normal TTL for others
  const cacheTTL = isTimeSensitive ? 60_000 : 300_000;
  if (cached && (Date.now() - cached.timestamp < cacheTTL)) {
    console.log(`[WebSearch] Returning cached results for: "${finalQuery}" (Depth: ${effectiveDepth})`);
    let responseText = `[As of ${currentDateEn} | Timezone: ${tz}] Search Results for "${query}" (Cached):\n\n`;
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
        results = await searchSerpApi(finalQuery, creds.serpapi_key, effectiveDepth);
      } catch (e: any) {
        console.warn(`[WebSearch] Primary provider (SerpApi) failed: ${e.message}. Switching to backup provider (DuckDuckGo)...`);
        try {
          results = await searchDuckDuckGo(finalQuery, effectiveDepth);
        } catch (e3) {
          console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
          results = await searchSearxng(finalQuery, effectiveDepth);
        }
      }
    } else if (provider === 'tavily' && creds.tavily_key) {
      try {
        results = await searchTavily(finalQuery, creds.tavily_key, effectiveDepth);
      } catch (e: any) {
        if (e.message.includes('401') || e.message.includes('429')) {
          console.warn('[WebSearch] Primary provider (Tavily) failed with 429/401. Switching to backup provider (Brave Search)...');
          if (creds.brave_key) {
            try {
              results = await searchBrave(finalQuery, creds.brave_key, effectiveDepth);
            } catch (e2: any) {
              console.warn('[WebSearch] Backup provider (Brave) failed. Falling back to DuckDuckGo (L3)...');
              try {
                results = await searchDuckDuckGo(finalQuery, effectiveDepth);
              } catch (e3) {
                console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
                results = await searchSearxng(finalQuery, effectiveDepth);
              }
            }
          } else {
            console.warn('[WebSearch] No backup premium provider found. Falling back to DuckDuckGo (L3)...');
            try {
              results = await searchDuckDuckGo(finalQuery, effectiveDepth);
            } catch (e3) {
              console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
              results = await searchSearxng(finalQuery, effectiveDepth);
            }
          }
        } else {
          throw e;
        }
      }
    } else if (provider === 'brave' && creds.brave_key) {
      try {
        results = await searchBrave(finalQuery, creds.brave_key, effectiveDepth);
      } catch (e: any) {
        if (e.message.includes('403') || e.message.includes('429')) {
          console.warn('[WebSearch] Primary provider (Brave) failed with 429/403. Switching to backup provider (Tavily)...');
          if (creds.tavily_key) {
            try {
              results = await searchTavily(finalQuery, creds.tavily_key, effectiveDepth);
            } catch (e2: any) {
              console.warn('[WebSearch] Backup provider (Tavily) failed. Falling back to DuckDuckGo (L3)...');
              try {
                results = await searchDuckDuckGo(finalQuery, effectiveDepth);
              } catch (e3) {
                console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
                results = await searchSearxng(finalQuery, effectiveDepth);
              }
            }
          } else {
            console.warn('[WebSearch] No backup premium provider found. Falling back to DuckDuckGo (L3)...');
            try {
              results = await searchDuckDuckGo(finalQuery, effectiveDepth);
            } catch (e3) {
              console.warn('[WebSearch] DuckDuckGo failed. Falling back to SearXNG Mesh...');
              results = await searchSearxng(finalQuery, effectiveDepth);
            }
          }
        } else {
          throw e;
        }
      }
    } else if (provider === 'duckduckgo') {
      try {
        results = await searchDuckDuckGo(finalQuery, effectiveDepth);
      } catch (e: any) {
        console.warn('[WebSearch] Primary provider (DuckDuckGo) failed. Falling back to SearXNG Mesh...');
        results = await searchSearxng(finalQuery, effectiveDepth);
      }
    } else {
      // Default 'mesh' provider - Prioritize DuckDuckGo as it's more reliable than public SearXNG instances
      try {
        results = await searchDuckDuckGo(finalQuery, effectiveDepth);
      } catch (e: any) {
        console.warn('[WebSearch] Mesh: DuckDuckGo failed. Falling back to SearXNG...');
        results = await searchSearxng(finalQuery, effectiveDepth);
      }
    }
  } catch (e: any) {
    return `[Search Failed] The web search failed due to an error: ${e.message}. CRITICAL INSTRUCTION: You MUST inform the user that the web search failed. Do NOT hallucinate or guess the answer.`;
  }
  
  if (results.length > 0) {
    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
  } else {
    return `[SEARCH_CONFIDENCE: LOW]\nSearch Results for "${query}": No results found. [Searched on ${currentDateEn} | Timezone: ${tz}]\n\nCRITICAL INSTRUCTION TO LLM: No results were found. You MUST tell the user the data is unavailable. Do NOT hallucinate an answer.`;
  }

  // ── Build output header ───────────────────────────────────────────────────
  let responseText = `[Search executed: ${currentDateEn} (${currentDateISO}) | Timezone: ${tz}]\n`;

  // ── Scrape top articles for depth=2 queries ───────────────────────────────
  let scrapedCount = 0;
  const scrapedContents: string[] = [];
  for (let index = 0; index < results.length; index++) {
    const r = results[index];
    if (effectiveDepth > 1 && index < 3) {
      const fullText = await scrapeUrl(r.url);
      if (fullText) {
        scrapedContents.push(fullText.replace(/\s+/g, ' ').substring(0, 4000));
        scrapedCount++;
      }
    }
  }

  // ── Confidence signal ─────────────────────────────────────────────────────
  // HIGH   = scraped 2+ full articles with substantial content
  // MEDIUM = only 1 article scraped, or articles were short
  // LOW    = no full content scraped — snippets only, high hallucination risk
  const confidence = scrapedCount >= 2 ? 'HIGH' : scrapedCount === 1 ? 'MEDIUM' : 'LOW';
  responseText += `[SEARCH_CONFIDENCE: ${confidence}]\n`;

  if (confidence === 'LOW' && (isTimeSensitive || isFactualQuery)) {
    responseText += `[WARNING: CONFIDENCE LOW — Only snippets available, no full article content. For ANY specific factual claim (scores, dates, names, prices, statistics, events), you MUST explicitly tell the user the data is unavailable in their language — NEVER fill gaps from training memory for 2024–2026 events.]\n`;
  }

  // ── Context Filter signal ─────────────────────────────────────────────────
  // When user asked about a SPECIFIC context (tournament round, specific date,
  // specific product, specific event), inject an explicit filter instruction.
  // This is the primary mechanism that prevents result mixing across contexts.
  if (detectedContext) {
    responseText += `[CONTEXT FILTER: User asked specifically about "${detectedContext}"]\n`;
    responseText += `[STRICT MATCH RULE: You MUST ONLY report results that EXPLICITLY confirm they are about "${detectedContext}". `;
    responseText += `If a result is about a DIFFERENT ${detectedContextCategory === 'tournament_round' ? 'tournament round (e.g. quarterfinal vs semifinal)' : 'context or category'}, `;
    responseText += `you MUST exclude it from your answer entirely. `;
    responseText += `If you cannot find a result that explicitly confirms "${detectedContext}", tell the user in their own language that you could not find specific data for "${detectedContext}" — do NOT substitute with adjacent data.]\n`;
  } else if (isFactualQuery || isTimeSensitive) {
    // General factual query — still enforce strict match
    responseText += `[STRICT ACCURACY RULE: Every specific fact you state (number, name, date, statistic) MUST come from an explicit statement in the results below — not inferred, not from training memory. If a result is from a different time period or context than what was asked, exclude it.]\n`;
  }

  responseText += `\nSearch Results for "${query}" [Searched: ${currentDateEn}]:\n\n`;

  // ── Per-result output with context verification tag ───────────────────────
  let scrapedIdx = 0;
  for (let index = 0; index < results.length; index++) {
    const r = results[index];
    const titleLower = (r.title || '').toLowerCase();
    const contentLower = (r.content || '').toLowerCase();

    // Tag each result with context match status so LLM can filter precisely
    let contextTag = '';
    if (detectedContext) {
      const contextTermLower = detectedContext.toLowerCase();
      const inTitle   = titleLower.includes(contextTermLower);
      const inContent = contentLower.includes(contextTermLower);
      if (inTitle || inContent) {
        contextTag = `[CONTEXT: MATCH ✓ — explicitly mentions "${detectedContext}"]`;
      } else {
        // Check aliases for common tournament terms
        const aliasMap: Record<string, string[]> = {
          'semifinal':   ['semi', '4 besar', 'empat besar', 'last four'],
          'final':       ['championship match', 'title match', 'grand final'],
          'quarterfinal':['8 besar', 'delapan besar', 'last eight', 'quarter'],
          'round of 16': ['16 besar', 'last 16', 'r16'],
        };
        const aliases = aliasMap[contextTermLower] || [];
        const matchesAlias = aliases.some(a => titleLower.includes(a) || contentLower.includes(a));
        if (matchesAlias) {
          contextTag = `[CONTEXT: LIKELY MATCH — contains alias for "${detectedContext}"]`;
        } else {
          contextTag = `[CONTEXT: UNVERIFIED — does NOT explicitly mention "${detectedContext}" — EXCLUDE from answer if uncertain]`;
        }
      }
    }

    responseText += `${index + 1}. ${r.title}\n`;
    if (contextTag) responseText += `   ${contextTag}\n`;
    responseText += `   URL: ${r.url}\n`;

    if (effectiveDepth > 1 && index < 3 && scrapedIdx < scrapedContents.length) {
      responseText += `   Full Content: ${scrapedContents[scrapedIdx]}...\n\n`;
      scrapedIdx++;
      continue;
    }
    responseText += `   Snippet: ${r.content}\n\n`;
  }

  return responseText.trim();
}

export const searchWebToolDefinition = {
  type: "function",
  function: {
    name: "search_web",
    description: [
      "Search the internet for real-time, accurate information across ALL domains.",
      "",
      "QUERY CONSTRUCTION RULES (critical for accuracy):",
      "- Be SPECIFIC and PRECISE. Include: exact event/topic + year + specific subcategory.",
      "- Sports: 'FIFA World Cup 2026 semifinal results July 15 2026' NOT 'world cup results'",
      "- News: 'Indonesia fuel price increase July 2026' NOT 'berita harga BBM'",
      "- Research: 'CRISPR gene therapy cancer clinical trial 2026 results'",
      "- Finance: 'Bitcoin BTC price USD July 15 2026'",
      "- If user asked about a SPECIFIC round/stage/category, include that EXACT term in the query.",
      "",
      "DEPTH RULES:",
      "- depth=1: fast snippet scan only (OK for: simple factual lookups, definitions, general knowledge)",
      "- depth=2: scrapes full article content from top 3 sources (REQUIRED for: ANY real-world event in 2024–2026, sports scores, election results, market prices, breaking news, research findings, match results, anything time-sensitive)",
      "- DEFAULT to depth=2 whenever uncertain.",
      "",
      "ANSWER RULES (non-negotiable):",
      "- NEVER answer from training memory after calling this tool.",
      "- Base your answer ONLY on what is EXPLICITLY stated in the search results below.",
      "- If [SEARCH_CONFIDENCE: LOW]: admit data is unavailable — do NOT guess.",
      "- If result is tagged [CONTEXT: UNVERIFIED]: exclude it from your answer.",
      "- If result is tagged [CONTEXT: MATCH ✓]: it is confirmed relevant — use it.",
      "- FORMATTING: Present the results as a clean, numbered list.",
      "- For each item, write the plain text title followed by a colon. On the NEXT line, indent the summary with 4 spaces (e.g., '1.  Title:\\n    Summary...').",
      "- Do NOT include ANY URLs, hyperlinks, or sources (like '(Sumber: ...)') in your response. The user only wants the clean text.",
      "- If search returns 0 results or all results are UNVERIFIED for the requested context: explicitly tell the user in their own language that the data is not available — do NOT substitute with adjacent or related data.",
    ].join("\n"),
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Precise, search-engine-optimized query. Include: specific entity + year + context (round, category, date). Examples: 'FIFA World Cup 2026 semifinal results July 15', 'Federal Reserve interest rate decision July 2026', 'Nature journal AI protein folding research 2026'. Do NOT use conversational phrasing.",
        },
        depth: {
          type: "number",
          description: "1 = snippets only (fast). 2 = full article scrape (required for all real-world facts from 2024-2026). Default: 2.",
        }
      },
      required: ["query"],
    },
  },
};
