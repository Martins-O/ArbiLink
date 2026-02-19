import { defineConfig, loadEnv } from 'vitepress'

const env     = loadEnv('', process.cwd(), '')
const demoUrl = env.VITE_DEMO_URL ?? 'https://arbi-link-demo.vercel.app'

export default defineConfig({
  title: 'ArbiLink',
  description: 'Universal Cross-Chain Messaging for Arbitrum',
  srcDir: '.',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['meta', { property: 'og:title',       content: 'ArbiLink Documentation' }],
    ['meta', { property: 'og:description', content: 'Build once on Arbitrum. Connect to everywhere.' }],
    ['meta', { property: 'og:image',       content: '/og-image.png' }],
    ['meta', { property: 'og:url',         content: 'https://docs.arbilink.dev' }],
    ['meta', { name: 'twitter:card',       content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title',      content: 'ArbiLink Documentation' }],
    ['meta', { name: 'twitter:description', content: 'Build once on Arbitrum. Connect to everywhere.' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'ArbiLink',

    nav: [
      { text: 'Home',            link: '/' },
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'SDK',             link: '/sdk/' },
      { text: 'Guides',          link: '/guides/' },
      { text: 'Examples',        link: '/examples/' },
      {
        text: 'v0.1.0',
        items: [
          { text: 'GitHub',    link: 'https://github.com/Martins-O/ArbiLink' },
          { text: 'Live Demo', link: demoUrl },
        ],
      },
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction',   link: '/getting-started/' },
            { text: 'Installation',   link: '/getting-started/installation' },
            { text: 'Quick Start',    link: '/getting-started/quick-start' },
            { text: 'First Message',  link: '/getting-started/first-message' },
          ],
        },
      ],

      '/sdk/': [
        {
          text: 'SDK Reference',
          items: [
            { text: 'Overview',       link: '/sdk/' },
            { text: 'ArbiLink Class', link: '/sdk/arbilink-class' },
            { text: 'Methods',        link: '/sdk/methods' },
            { text: 'Types',          link: '/sdk/types' },
            { text: 'Errors',         link: '/sdk/errors' },
          ],
        },
      ],

      '/guides/': [
        {
          text: 'Guides',
          items: [
            { text: 'Overview',          link: '/guides/' },
            { text: 'Cross-Chain NFTs',  link: '/guides/nft-minting' },
            { text: 'Token Transfers',   link: '/guides/token-transfers' },
            { text: 'DAO Voting',        link: '/guides/dao-voting' },
            { text: 'Advanced Patterns', link: '/guides/advanced-patterns' },
          ],
        },
      ],

      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview',      link: '/examples/' },
            { text: 'Basic',         link: '/examples/basic' },
            { text: 'Intermediate',  link: '/examples/intermediate' },
            { text: 'Advanced',      link: '/examples/advanced' },
          ],
        },
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview',        link: '/api/' },
            { text: 'Smart Contracts', link: '/api/contracts' },
            { text: 'Events',          link: '/api/events' },
            { text: 'Architecture',    link: '/api/architecture' },
          ],
        },
      ],

      '/resources/': [
        {
          text: 'Resources',
          items: [
            { text: 'Overview',        link: '/resources/' },
            { text: 'FAQ',             link: '/resources/faq' },
            { text: 'Troubleshooting', link: '/resources/troubleshooting' },
            { text: 'Support',         link: '/resources/support' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Martins-O/ArbiLink' },
    ],

    footer: {
      message: 'Built for Arbitrum Open House NYC | Released under the MIT License',
      copyright: 'Copyright © 2026 ArbiLink',
    },

    search: {
      provider: 'local',
      options: { detailedView: true },
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },
  },

  markdown: {
    theme: 'github-dark',
    lineNumbers: true,
  },

  vite: {
    define: {
      __DEMO_URL__: JSON.stringify(demoUrl),
    },
  },

  // Rewrite __DEMO_URL__ in frontmatter hero actions at build time
  transformPageData(pageData) {
    if (pageData.frontmatter?.hero?.actions) {
      pageData.frontmatter.hero.actions = pageData.frontmatter.hero.actions.map(
        (action: { link: string; [key: string]: unknown }) => ({
          ...action,
          link: action.link === '__DEMO_URL__' ? demoUrl : action.link,
        }),
      )
    }
  },
})
