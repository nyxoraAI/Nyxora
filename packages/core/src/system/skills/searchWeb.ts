import { loadConfig, loadApiKeys } from '../../config/parser';
import { DOMParser } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { search, SafeSearchType } from 'duck-duck-scrape';

async function scrapeUrl(url: string, scraper: string, creds: any): Promise<string | null> {
  try {
    if (scraper === 'jina') {
      const headers: any = { 'User-Agent': 'Mozilla/5.0 (compatible; NyxoraBot/1.0)' };
      if (creds.jina_key) headers['Authorization'] = `Bearer ${creds.jina_key}`;
      const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(10000) });
      if (res.ok) return await res.text();
      console.warn(`[Scraper] Jina returned status ${res.status}`);
    } else if (scraper === 'firecrawl') {
      if (creds.firecrawl_key) {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${creds.firecrawl_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url, formats: ['markdown'] }),
          signal: AbortSignal.timeout(15000)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && json.data.markdown) return json.data.markdown;
        } else {
          console.warn(`[Scraper] Firecrawl returned status ${res.status}`);
        }
      } else {
        console.warn(`[Scraper] Firecrawl API Key missing. Falling back to default.`);
      }
    } else if (scraper === 'crawl4ai') {
      const endpoint = creds.crawl4ai_endpoint || 'http://localhost:11227/crawl';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: url }),
        signal: AbortSignal.timeout(30000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.results && json.results[0] && json.results[0].markdown) {
          return json.results[0].markdown;
        }
      } else {
        console.warn(`[Scraper] Crawl4AI failed at ${endpoint} with status ${res.status}`);
      }
    } else if (scraper === 'puppeteer' || scraper === 'browserbase') {
      try {
        const { chromium } = require('playwright');
        let browser;
        if (scraper === 'browserbase' && creds.browserbase_project_id && creds.browserbase_key) {
          browser = await chromium.connectOverCDP(`wss://connect.browserbase.com?apiKey=${creds.browserbase_key}&projectId=${creds.browserbase_project_id}`);
        } else {
          browser = await chromium.launch({ headless: true });
        }
        const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        const textContent = await page.evaluate(() => {
          document.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
          return document.body.innerText;
        });
        await browser.close();
        return textContent.replace(/\s+/g, ' ').trim();
      } catch (e: any) {
        console.warn(`[Scraper] Playwright/Browserbase failed: ${e.message}`);
      }
    }

    // Default built-in engine (linkedom + readability) / Cheerio fallback
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NyxoraBot/1.0)' }, signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reader = new Readability(doc as any);
    const article = reader.parse();
    return article ? article.textContent : null;
  } catch (e: any) {
    console.error(`[Scraper] Failed to scrape ${url} with ${scraper}: ${e.message}`);
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
  const maxResults = depth > 1 ? 20 : 10;
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
  const count = depth > 1 ? 20 : 10;
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
  const maxResults = depth > 1 ? 20 : 10;
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
      const maxResults = depth > 1 ? 20 : 10;
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
  const num = depth > 1 ? 20 : 10;
  const res = await fetch(`https://serpapi.com/search?engine=google&q=${q}&api_key=${apiKey}&num=${num}`);
  
  if (!res.ok) {
    throw new Error(`[SerpApi Error] Status: ${res.status}`);
  }
  
  const json = await res.json();
  const results: SearchQueryResult[] = [];

  const answerText = json.answer_box?.answer || json.answer_box?.result || json.answer_box?.snippet;
  if (json.answer_box && answerText) {
    results.push({
      title: json.answer_box.title || "Direct Answer",
      url: json.answer_box.link || "#",
      content: answerText
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
    lowerQuery.includes('breaking');

  // ── Detect specific context/round that user is asking about ────────────────
  // This prevents the LLM from mixing results across tournament stages, news
  // categories, etc. e.g. "semifinal" results vs "quarterfinal" results.
  type ContextCategory = 'tournament_round' | 'match_specific' | 'standings' | 'schedule' | null;
  let detectedContext: string | null = null;
  let detectedContextCategory: ContextCategory = null;

  // Tournament rounds
  if (/semifinal|semi final|semi-final/i.test(lowerQuery)) {
    detectedContext = 'semifinal';
    detectedContextCategory = 'tournament_round';
  } else if (/final\b|the final/i.test(lowerQuery)) {
    detectedContext = 'final';
    detectedContextCategory = 'tournament_round';
  } else if (/quarter.?final/i.test(lowerQuery)) {
    detectedContext = 'quarterfinal';
    detectedContextCategory = 'tournament_round';
  } else if (/round of 16|last 16/i.test(lowerQuery)) {
    detectedContext = 'round of 16';
    detectedContextCategory = 'tournament_round';
  } else if (/group stage/i.test(lowerQuery)) {
    detectedContext = 'group stage';
    detectedContextCategory = 'tournament_round';
  } else if (/standings|table/i.test(lowerQuery)) {
    detectedContext = 'standings';
    detectedContextCategory = 'standings';
  } else if (/schedule|fixture/i.test(lowerQuery)) {
    detectedContext = 'schedule';
    detectedContextCategory = 'schedule';
  }

  // Detect substantive informational queries across ALL domains (Tech, Science, Coding,
  // General Knowledge, Health, Law, Culture, Sports, News, Finance, Reference, etc.)
  const isFactualQuery =
    query.trim().split(/\s+/).length >= 3 ||
    // Tech & Engineering / Coding / Docs
    lowerQuery.includes('how') || lowerQuery.includes('what') ||
    lowerQuery.includes('why') || lowerQuery.includes('who') ||
    lowerQuery.includes('when') || lowerQuery.includes('where') ||
    lowerQuery.includes('explain') || lowerQuery.includes('difference') ||
    lowerQuery.includes('vs') || lowerQuery.includes('tutorial') ||
    lowerQuery.includes('guide') || lowerQuery.includes('error') ||
    lowerQuery.includes('fix') || lowerQuery.includes('bug') ||
    lowerQuery.includes('release') || lowerQuery.includes('version') ||
    lowerQuery.includes('feature') || lowerQuery.includes('update') ||
    lowerQuery.includes('documentation') || lowerQuery.includes('api') ||
    lowerQuery.includes('setup') || lowerQuery.includes('install') ||
    lowerQuery.includes('compare') || lowerQuery.includes('review') ||
    // Science, General Knowledge, Health, Law
    lowerQuery.includes('definition') || lowerQuery.includes('meaning') ||
    lowerQuery.includes('history') || lowerQuery.includes('biography') ||
    lowerQuery.includes('overview') || lowerQuery.includes('summary') ||
    lowerQuery.includes('law') || lowerQuery.includes('regulation') ||
    lowerQuery.includes('health') || lowerQuery.includes('symptom') ||
    // Sports, News, Research & Finance
    lowerQuery.includes('score') || lowerQuery.includes('result') ||
    lowerQuery.includes('match') || lowerQuery.includes('tournament') ||
    lowerQuery.includes('news') || lowerQuery.includes('research') ||
    lowerQuery.includes('paper') || lowerQuery.includes('study') ||
    lowerQuery.includes('price') || lowerQuery.includes('stock') ||
    lowerQuery.includes('market') || lowerQuery.includes('company');

  // Force depth=2 for informational/factual queries to scrape full article text like ChatGPT Search
  const effectiveDepth = (isTimeSensitive || isFactualQuery) ? Math.max(depth, 2) : depth;
  if (effectiveDepth > depth) {
    console.log(`[WebSearch] Auto-upgraded to depth=2 for factual/temporal query: "${query}"`);
  }

  if (isTimeSensitive) {
    // Replace time-relative words with the actual English date for the search engine.
    // English date format works universally across all search providers.
    finalQuery = query
      .replace(/\btoday\b/gi, currentDateEn)
      .replace(/\byesterday\b/gi, (() => {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      })())
      .replace(/\btomorrow\b/gi, (() => {
        const d = new Date(now); d.setDate(d.getDate() + 1);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      })());

    // Only append today's date if the query doesn't already specify an explicit year or timeframe (past, future, next month/year, 10/15 years ahead, etc.)
    const hasExplicitYearOrPeriod = /\b(18|19|20|21)\d{2}\b/.test(finalQuery) || /\b(next|last|future|past|decade|century|timeline|forecast|projection|history|historical|upcoming|ahead)\b/i.test(finalQuery);
    if (!hasExplicitYearOrPeriod) finalQuery += ` ${currentDateEn}`;
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
    // Only append today's date if no explicit year or timeframe is specified
    const hasExplicitYearOrPeriod = /\b(18|19|20|21)\d{2}\b/.test(finalQuery) || /\b(next|last|future|past|decade|century|timeline|forecast|projection|history|historical|upcoming|ahead)\b/i.test(finalQuery);
    if (!hasExplicitYearOrPeriod) finalQuery += ` ${currentDateEn}`;
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
  const scraper = config.web_search?.scraper || 'default';
  const vaultKeys = await loadApiKeys();
  const creds = { ...(config.credentials || {}), ...vaultKeys };
  
  let results: SearchQueryResult[] = [];

  const fallback_provider = config.web_search?.fallback_provider || 'duckduckgo';

  async function executeSearchHelper(prov: string, q: string, d: number): Promise<SearchQueryResult[]> {
    if (prov === 'serpapi') {
      if (!creds.serpapi_key) throw new Error('SerpApi key missing');
      return await searchSerpApi(q, creds.serpapi_key, d);
    }
    if (prov === 'tavily') {
      if (!creds.tavily_key) throw new Error('Tavily key missing');
      return await searchTavily(q, creds.tavily_key, d);
    }
    if (prov === 'brave') {
      if (!creds.brave_key) throw new Error('Brave key missing');
      return await searchBrave(q, creds.brave_key, d);
    }
    if (prov === 'duckduckgo') return await searchDuckDuckGo(q, d);
    if (prov === 'mesh') return await searchSearxng(q, d);
    throw new Error(`Provider ${prov} not configured`);
  }
  
  try {
    try {
      console.log(`[WebSearch] Executing primary search via ${provider} for: "${finalQuery}"`);
      results = await executeSearchHelper(provider, finalQuery, effectiveDepth);
    } catch (e: any) {
      console.warn(`[WebSearch] Primary provider (${provider}) failed: ${e.message}. Switching to fallback provider (${fallback_provider})...`);
      try {
        results = await executeSearchHelper(fallback_provider, finalQuery, effectiveDepth);
      } catch (e2: any) {
        console.warn(`[WebSearch] Fallback provider (${fallback_provider}) failed. Falling back to DuckDuckGo/Mesh...`);
        try {
          results = await searchDuckDuckGo(finalQuery, effectiveDepth);
        } catch (e3) {
          results = await searchSearxng(finalQuery, effectiveDepth);
        }
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
    if (effectiveDepth > 1 && index < 5) {
      const fullText = await scrapeUrl(r.url, scraper, creds);
      if (fullText) {
        scrapedContents.push(fullText.replace(/\s+/g, ' ').substring(0, 30000));
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
    responseText += `[NOTE: Only snippets available. Base your answer carefully on the snippets below. Do NOT hallucinate facts not present in the snippets.]\n`;
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

  responseText += `[ANTI-HALLUCINATION & ANTI-LOOP RULE: Do NOT generate repetitive filler words, stream-of-consciousness monologues, or word-salad loops. Output ONLY a clean, concise, structured summary of verified facts. If a specific date, number, or detail is not present in the results below, state "Not specified in search results" — NEVER use blank placeholders (_____) or ramble.]\n`;
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
        // Check aliases for common tournament and contest terms
        const aliasMap: Record<string, string[]> = {
          'semifinal':   ['semi', 'semis', 'last four', 'semi-finals'],
          'final':       ['championship match', 'title match', 'grand final', 'championship'],
          'quarterfinal':['quarters', 'last eight', 'quarter-finals'],
          'round of 16': ['last 16', 'r16', 'eight-finals'],
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

    responseText += `   Snippet: ${r.content}\n`;
    if (effectiveDepth > 1 && index < 5 && scrapedIdx < scrapedContents.length) {
      const scrapedText = scrapedContents[scrapedIdx];
      scrapedIdx++;
      if (scrapedText && scrapedText.length > 100 && !scrapedText.toLowerCase().includes('cloudflare') && !scrapedText.toLowerCase().includes('access denied')) {
        responseText += `   Full Content: ${scrapedText}...\n`;
      }
    }
    responseText += `\n`;
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
      "- Be SPECIFIC and PRECISE. Include: exact entity/topic + relevant year/date (past, present, or future) + specific subcategory.",
      "- Tech/Coding: 'React 19 compiler setup guide' NOT 'react tutorial'",
      "- Science/Future: 'NASA Mars colonization missions timeline 2030-2040'",
      "- History/Past: '1998 World Cup final match score and summary'",
      "- News/Current: 'Global energy price trends recent developments'",
      "- Finance/Markets: 'Bitcoin BTC price USD historical and future outlook'",
      "- If user asked about a SPECIFIC round/stage/category or specific future/past timeframe (next month, next year, 10-15+ years ahead), include that EXACT term in the query.",
      "",
      "DEPTH RULES:",
      "- depth=1: fast snippet scan only (OK for: simple factual lookups, definitions, general knowledge)",
      "- depth=2: scrapes full article content from top 5 sources (REQUIRED for: ANY real-world event across any time period—past, present, or future—technology tutorials, coding questions, historical data, future projections, sports scores, market prices, breaking news, research findings, anything informational)",
      "- DEFAULT to depth=2 whenever uncertain.",
      "",
      "ANSWER RULES (non-negotiable):",
      "- NEVER answer from training memory after calling this tool.",
      "- NEVER generate repetitive filler words, stream-of-consciousness monologues, or word-salad loops.",
      "- Base your answer ONLY on what is EXPLICITLY stated in the search results below.",
      "- If exact dates, numbers, or details are missing in the search results, explicitly state 'Not specified in search results' — do NOT guess, leave blank placeholders (_______), or ramble.",
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
          description: "Precise, search-engine-optimized query across any domain and time period (past history, current events, or future projections 10-15+ years ahead). Include specific entity + relevant date/year if applicable + context. Do NOT use conversational phrasing.",
        },
        depth: {
          type: "number",
          description: "1 = snippets only (fast). 2 = full article scrape (required for all real-world facts, historical research, current events, and future projections across all years). Default: 2.",
        }
      },
      required: ["query"],
    },
  },
};
