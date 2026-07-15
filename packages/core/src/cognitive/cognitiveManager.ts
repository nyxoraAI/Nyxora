import fs from 'fs';
import path from 'path';

export class CognitiveManager {
  private promptsPath: string;

  constructor() {
    this.promptsPath = path.join(__dirname, 'prompts');
  }

  public loadActiveCognitiveSkills(intent: string): string {
    const activeSOPs: string[] = [];
    const lowerIntent = intent.toLowerCase();

    // ── Software Development SOPs ──────────────────────────────────────────
    const devSkillMappings = [
      {
        keywords: ['debug', 'error', 'bug', 'fix', 'crash', 'fail', 'trace', 'exception', 'undefined', 'null'],
        file: 'software-development/systematic-debugging.md'
      },
      {
        keywords: ['tdd', 'test', 'red green', 'unit test', 'jest', 'mocha', 'vitest'],
        file: 'software-development/test-driven-development.md'
      },
      {
        keywords: ['plan', 'architecture', 'design', 'structure', 'blueprint', 'refactor'],
        file: 'software-development/plan.md'
      },
    ];

    // ── Web3 / Trading SOPs ────────────────────────────────────────────────
    //
    // NOTE FOR CONTRIBUTORS: Keyword arrays are intentionally multilingual.
    // Nyxora is a global product used by speakers of many languages.
    // Each array includes English terms (primary) and Indonesian terms (id)
    // as the initial non-English locale. Additional languages can be added
    // to each keywords array without changing any other code.
    //
    const web3SkillMappings = [
      {
        // Market analysis: price action, momentum, trend direction
        keywords: [
          // English
          'analysis', 'market', 'chart', 'rsi', 'ma50', 'momentum',
          'signal', 'bullish', 'bearish', 'trend', 'price', 'pump', 'dump',
          // Indonesian (id)
          'analisis', 'harga',
        ],
        file: 'web3/market-analysis.md'
      },
      {
        // Risk assessment: security, liquidity, holder concentration
        keywords: [
          // English
          'risk', 'safe', 'honeypot', 'rug', 'scam', 'dangerous',
          'liquidity', 'security', 'holder',
          // Indonesian (id)
          'risiko', 'aman', 'likuiditas', 'keamanan',
        ],
        file: 'web3/risk-assessment.md'
      },
      {
        // Trade planning: entry/exit strategy, order types
        keywords: [
          // English
          'trade', 'trading', 'entry', 'exit', 'buy', 'sell',
          'swap', 'position', 'stop loss', 'take profit', 'tp', 'sl',
          'strategy', 'dca', 'limit order',
          // Indonesian (id)
          'beli', 'jual', 'posisi', 'strategi',
        ],
        file: 'web3/trade-planning.md'
      },
      {
        // Portfolio review: holdings, rebalancing, allocation
        keywords: [
          // English
          'portfolio', 'balance', 'rebalance', 'holdings',
          'asset', 'diversif', 'allocation',
          // Indonesian (id)
          'portofolio', 'saldo', 'aset', 'alokasi',
        ],
        file: 'web3/portfolio-review.md'
      },
    ];

    const allMappings = [...devSkillMappings, ...web3SkillMappings];

    for (const mapping of allMappings) {
      if (mapping.keywords.some(kw => lowerIntent.includes(kw))) {
        const fullPath = path.join(this.promptsPath, mapping.file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const skillName = path.basename(mapping.file, '.md').toUpperCase().replace(/-/g, ' ');
          activeSOPs.push(`--- COGNITIVE SKILL: ${skillName} ---\n${content}`);
        }
      }
    }

    if (activeSOPs.length === 0) {
      return '';
    }

    return activeSOPs.join('\n\n');
  }
}

export const cognitiveManager = new CognitiveManager();
