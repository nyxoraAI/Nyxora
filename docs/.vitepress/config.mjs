import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Nyxora",
  description: "Secure AI execution framework for Web3 agents",
  base: '/Nyxora/',
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
          { text: '🌐 Nyxora Ecosystem', link: '/guide/ecosystem' }
        ]
      },
      {
        text: 'Core Capabilities',
        items: [
          { text: '🧠 Native Skills', link: '/skills/native' },
          { text: '🔗 External Plugins', link: '/guide/custom_skills' },
          { text: '🪙 Chain Specifics', link: '/skills/chains' },
          { text: '🗂️ NLP Security Policy', link: '/skills/nlp' }
        ]
      },
      {
        text: 'Operations & Security',
        items: [
          { text: '🛡️ Wallet Import Guide', link: '/security/wallet_import' },
          { text: '🔑 Master Password Vault', link: '/security/vault' },
          { text: '📦 Plugin Sandbox VM', link: '/security/sandbox' },
          { text: '📊 Analytics Dashboard', link: '/security/dashboard' },
          { text: '🛟 Troubleshooting', link: '/security/troubleshooting' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/perasyudha/Nyxora' }
    ]
  }
})
