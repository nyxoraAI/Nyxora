import { defineConfig } from 'vitepress'

const globalSidebar = [
  {
    text: 'Introduction',
    items: [
      { text: 'Overview', link: '/' },
      { text: 'Getting Started', link: '/docs' },
      { text: 'Installation Guide', link: '/installation' },
      { text: 'Nyxora Ecosystem', link: '/ecosystem' }
    ]
  },
  {
    text: 'Developer & Architecture',
    items: [
      { text: 'Technical Architecture', link: '/architecture' },
      { text: 'Cross-Chain Routing', link: '/bridge-routing' },
      { text: 'Codebase Structure', link: '/structure' },
      { text: 'Contributing Guide', link: '/contributing' },
      { text: 'Guarded Autonomy', link: '/guarded_autonomy' },
      { text: 'Memory Architecture', link: '/memory-architecture' },
      { text: 'Nyxora Next Update', link: '/roadmap' }
    ]
  },
  {
    text: 'Core Capabilities',
    items: [
      { text: 'Native Skills', link: '/native' },
      { text: 'Market Intelligence', link: '/market-intelligence' },
      { text: 'Web Search & Deep Research', link: '/web-search' },
      { text: 'Google Workspace MVP', link: '/google-workspace' },
      { text: 'DeFi Configuration', link: '/defi-config' },
      { text: 'Market Oracles', link: '/market-oracles' },
      { text: 'Understanding Slippage', link: '/slippage' },
      { text: 'Chain Specifics', link: '/chains' },
      { text: 'Custom RPC Configuration', link: '/rpc' },
      { text: 'Etherscan API V2 Key', link: '/etherscan' },
      { text: 'NLP Security Policy', link: '/nlp' }
    ]
  },
  {
    text: 'Operations & Security',
    items: [
      { text: 'Base Smart Contract', link: '/smart-contract' },
      { text: 'Wallet Import Guide', link: '/wallet_import' },
      { text: 'OS-Native Keyring Vault', link: '/vault' },
      { text: 'Policy Engine', link: '/sandbox' },
      { text: 'Analytics Dashboard', link: '/dashboard' },
      { text: 'Troubleshooting', link: '/troubleshooting' }
    ]
  },
  {
    text: 'Legal',
    items: [
      { text: 'Privacy Policy', link: '/privacy' },
      { text: 'Terms of Service', link: '/terms' }
    ]
  }
];

export default defineConfig({
  title: "Nyxora Protocol",
  description: "Secure AI execution framework for Web3 agents",
  base: '/Nyxora/',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/Nyxora/favicon.svg' }],
    ['meta', { name: 'talentapp:project_verification', content: 'c2efaae47344a9e37665b659cea484364b58a60fe274af503d41914c26f547eea61393229ee5ba8f49dbdcc088d9eaad66687065bd84181dbacf87c2e70aceb9' }],
    [
      'script',
      { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-NK5D8WN7RE' }
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-NK5D8WN7RE');`
    ]
  ],
  themeConfig: {
    search: {
      provider: 'local'
    },
    logo: '/favicon.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs', activeMatch: '^/(?!$|index\\.html|cli/|mcp/|plugins/|sdk/)' },
      { text: 'CLI Reference', link: '/cli/', activeMatch: '^/cli/' },
      { text: 'MCP', link: '/mcp/', activeMatch: '^/mcp/' },
      { text: 'Plugin Registry', link: '/plugins/', activeMatch: '^/plugins/' },
      { text: 'Nyxora SDK', link: '/sdk/', activeMatch: '^/sdk/' }
    ],

    sidebar: {
      '/sdk/': [
        {
          text: 'Nyxora SDK Framework',
          items: [
            { text: 'Overview & Architecture', link: '/sdk/' },
            { text: 'Umbrella Package', link: '/sdk/umbrella' },
            { text: 'Core SDK', link: '/sdk/core' },
            { text: 'Policy SDK', link: '/sdk/policy' },
            { text: 'Signer SDK', link: '/sdk/signer' }
          ]
        }
      ],
      '/plugins/': [
        {
          text: 'Plugin Registry',
          items: [
            { text: 'System Overview', link: '/plugins/' },
            { text: 'Creating Custom Plugins', link: '/plugins/custom-plugins' },
            { text: 'Custom DeFi Providers', link: '/plugins/defi-providers' }
          ]
        }
      ],
      '/cli/': [
        {
          text: 'CLI Reference',
          items: [
            { text: 'Overview & Flags', link: '/cli/' },
            { text: 'Daemon & Interface', link: '/cli/daemon' },
            { text: 'Setup & Diagnostics', link: '/cli/setup' }
          ]
        }
      ],
      '/mcp/': [
        {
          text: 'MCP Integration',
          items: [
            { text: 'Overview & Setup', link: '/mcp/' },
            { text: 'Claude Desktop', link: '/mcp/claude' },
            { text: 'Cursor IDE', link: '/mcp/cursor' },
            { text: 'Available Capabilities', link: '/mcp/capabilities' }
          ]
        }
      ],
      '/': globalSidebar
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nyxoraAI/Nyxora' },
      { 
        icon: {
          svg: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M15.418 7H17.2L13.3 11.45L17.882 17.5H14.3L11.498 13.84L8.298 17.5H6.518L10.74 12.678L6.37 7H10.052L12.59 10.334L15.418 7ZM14.814 16.434H15.8L9.382 7.962H8.322L14.814 16.434Z" fill="var(--vp-c-bg)"/></svg>'
        }, 
        link: 'https://x.com/Nyxora_AI' 
      }
    ]
  }
})
