import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Nyxora",
  description: "Secure AI execution framework for Web3 agents",
  base: '/',
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
          { text: '🪙 Chain Specifics', link: '/skills/chains' },
          { text: '🔌 Custom RPC Configuration', link: '/skills/rpc' },
          { text: '🗂️ NLP Security Policy', link: '/skills/nlp' }
        ]
      },
      {
        text: 'Operations & Security',
        items: [
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
      { icon: 'github', link: 'https://github.com/nyxoraAI/Nyxora' }
    ]
  }
})
