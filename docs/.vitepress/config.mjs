import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Nyxora",
  description: "Secure AI execution framework for Web3 agents",
  base: '/Nyxora/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/installation' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Installation', link: '/guide/installation' }
        ]
      },
      {
        text: 'Security',
        items: [
          { text: 'Wallet Import Guide', link: '/security/wallet_import' },
          { text: 'Master Password Vault', link: '/security/vault' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/perasyudha/Nyxora' }
    ]
  }
})
