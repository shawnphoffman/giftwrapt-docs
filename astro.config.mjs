// @ts-check
import { fileURLToPath } from 'node:url'

import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightChangelogs, { makeChangelogsSidebarLinks } from 'starlight-changelogs'

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
			plugins: [starlightChangelogs()],
			description: 'Self-hostable wish list app for families and small groups.',
			components: {
				Hero: './src/components/Hero.astro',
			},
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
			// editLink: {
			// 	baseUrl: 'https://github.com/shawnphoffman/giftwrapt/edit/main/docs/',
			// },
			lastUpdated: true,
			sidebar: [
				{
					label: 'Overview',
					items: [
						{ label: 'Getting Started', slug: 'overview/getting-started' },
						{ label: 'Screenshots', slug: 'overview/screenshots' },
						{ label: 'Glossary', slug: 'overview/glossary' },
					],
				},
				{
					label: 'Deploy',
					items: [{ autogenerate: { directory: 'deploy' } }],
				},
				{
					label: 'Features',
					items: [{ autogenerate: { directory: 'features' } }],
				},
				{
					label: 'Permissions',
					items: [{ autogenerate: { directory: 'permissions' } }],
				},
				{
					label: 'Configuration',
					items: [{ autogenerate: { directory: 'configuration' } }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{
					label: 'Changelog',
					items: [
						...makeChangelogsSidebarLinks([
							{
								type: 'latest',
								base: 'changelog',
								label: 'Latest Version',
							},
							{
								type: 'all',
								base: 'changelog',
								label: 'All Versions',
							},
						]),
					],
				},
			],
		}),
	],
})
