import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Nyxora",
  description: "Secure AI execution framework for Web3 agents",
  base: '/Nyxora/',
  head: [
    ['meta', { name: 'talentapp:project_verification', content: 'c2efaae47344a9e37665b659cea484364b58a60fe274af503d41914c26f547eea61393229ee5ba8f49dbdcc088d9eaad66687065bd84181dbacf87c2e70aceb9' }]
  ],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/introduction' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: '👋 Overview', link: '/' },
          { text: '🚀 Getting Started', link: '/guide/introduction' },
          { text: '💻 Installation Guide', link: '/guide/installation' },
          { text: '🌐 Nyxora Ecosystem', link: '/guide/ecosystem' }
        ]
      },
      {
        text: 'Developer & Architecture',
        items: [
          { text: '🏗️ Technical Architecture', link: '/guide/architecture' },
          { text: '🔌 MCP Integration Guide', link: '/guide/mcp-integration' },
          { text: '🧠 Guarded Autonomy', link: '/guide/guarded_autonomy' },
          { text: '🗄️ Memory Architecture', link: '/guide/memory-architecture' },
          { text: '🛣️ Nyxora Next Update', link: '/guide/roadmap' }
        ]
      },
      {
        text: 'Core Capabilities',
        items: [
          { text: '🧠 Native Web3 Skills', link: '/skills/native' },
          { text: '🔍 Web Search & Deep Research', link: '/skills/web-search' },
          { text: '💻 Google Workspace MVP', link: '/skills/google-workspace' },
          { text: '🔗 External Plugins', link: '/guide/custom_skills' },
          { text: '⚙️ DeFi Configuration', link: '/skills/defi-config' },
          { text: '📈 Understanding Slippage', link: '/skills/slippage' },
          { text: '🪙 Chain Specifics', link: '/skills/chains' },
          { text: '🔌 Custom RPC Configuration', link: '/skills/rpc' },
          { text: '🔑 Etherscan API V2 Key', link: '/skills/etherscan' },
          { text: '🗂️ NLP Security Policy', link: '/skills/nlp' }
        ]
      },
      {
        text: 'Operations & Security',
        items: [
          { text: '⛓️ Arbitrum Smart Contract', link: '/security/smart-contract' },
          { text: '🛡️ Wallet Import Guide', link: '/security/wallet_import' },
          { text: '🔐 OS-Native Keyring Vault', link: '/security/vault' },
          { text: '📦 Plugin Sandbox VM', link: '/security/sandbox' },
          { text: '📊 Analytics Dashboard', link: '/security/dashboard' },
          { text: '🛟 Troubleshooting', link: '/security/troubleshooting' }
        ]
      },
      {
        text: 'Legal',
        items: [
          { text: '📜 Privacy Policy', link: '/privacy' },
          { text: '⚖️ Terms of Service', link: '/terms' }
        ]
      }
    ],

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
