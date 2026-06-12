# 🔍 Web Search & Deep Research

Nyxora features an incredibly robust Web Search module engineered specifically for Agentic AI workflows. It allows the agent to break out of its training data cutoff and fetch real-time market data, news, and technical information directly from the internet.

## 🧠 L3 Auto-Failover Architecture

Nyxora guarantees 100% search uptime by utilizing a three-layer fallback mechanism:

1.  **Primary Engine (Tavily/Brave):** 
    By default, Nyxora attempts to use premium search APIs (Tavily or Brave) configured via your API keys.
2.  **Secondary Engine Fallback:** 
    If your primary provider encounters a Rate Limit (`429`) or Authentication Error (`401/403`), Nyxora instantly falls back to the secondary provider (e.g., from Tavily to Brave).
3.  **Decentralized Mesh (L3 Fallback):** 
    If both commercial APIs fail, or if you choose not to configure any API keys, Nyxora automatically reroutes the search query to a decentralized network of public **SearXNG** instances.

## ⚡ Smart Memory Cache

To conserve API quotas and drastically reduce latency, Nyxora implements an in-memory **Smart Cache**. 

If the agent searches for the exact same query within a **5-minute window**, Nyxora bypasses the network entirely and returns the cached results in 0 milliseconds.

## 🕵️‍♂️ Deep Research Mode

The search module accepts a dynamic `depth` parameter (1 to 3). 
- **Depth 1 (Default):** Fetches the top 5-8 results for quick context.
- **Depth 2-3 (Advanced):** If you instruct the agent to perform comprehensive research (e.g., *"Conduct a deep research on Solana's architecture"*), the AI will automatically scale the depth parameter. This triggers `advanced` payload modes on Tavily/Brave, pulling up to 15 top snippets and returning a highly detailed data dump for the AI to analyze.

## 🕰️ Time-Context Awareness (Auto-Inject Year)

A common issue with AI web searches is fetching outdated SEO articles (e.g., news from 2024 when the current year is 2026). 

To prevent this, Nyxora actively parses the agent's query. If it detects time-sensitive keywords like *"hari ini"*, *"sekarang"*, *"today"*, or *"terbaru"*, Nyxora will **auto-inject the current year** (e.g., `2026`) into the search query, forcing the search engine to return the most up-to-date real-world events.
