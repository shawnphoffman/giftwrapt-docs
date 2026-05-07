// @ts-check
import { fileURLToPath } from 'node:url'

import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

// See src/shims/nanoid-non-secure.js for why this alias exists.
const nanoidShim = fileURLToPath(new URL('./src/shims/nanoid-non-secure.js', import.meta.url))

export default defineConfig({
	site: 'https://giftwrapt.dev',
	vite: {
		resolve: {
			alias: {
				'nanoid/non-secure': nanoidShim,
			},
		},
	},
	integrations: [
		starlight({
			title: 'GiftWrapt',
			description: 'Self-hostable wish list app for families and small groups.',
			logo: {
				src: './src/assets/logo.png',
				replacesTitle: false,
			},
			favicon: '/favicon.ico',
			head: [
				{
					tag: 'link',
					attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
				},
				{
					tag: 'link',
					attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
				},
			],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/shawnphoffman/giftwrapt',
				},
			],
			editLink: {
				baseUrl: 'https://github.com/shawnphoffman/giftwrapt/edit/main/docs/',
			},
			lastUpdated: true,
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Overview', slug: 'docs' },
						{ label: 'Local development', slug: 'docs/getting-started' },
						{ label: 'Contributing', slug: 'docs/contributing' },
					],
				},
				{
					label: 'Self-Hosting',
					items: [
						{ label: 'Deployment', slug: 'docs/deployment' },
						{ label: 'Docker self-host', slug: 'docs/self-hosting' },
						{ label: 'Storage backends', slug: 'docs/storage' },
					],
				},
				{
					label: 'Features',
					items: [{ autogenerate: { directory: 'docs/features' } }],
				},
				{
					label: 'Reference',
					items: [{ label: 'URL scraping', slug: 'docs/scraping' }],
				},
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'docs/guides' } }],
				},
			],
		}),
	],
})
