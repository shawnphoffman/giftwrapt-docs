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
						{ label: 'Getting started', slug: 'overview/getting-started' },
						{ label: 'Screenshots', slug: 'overview/screenshots' },
					],
				},
				{
					label: 'Deploy',
					items: [
						{ label: 'Self-hosting', slug: 'deploy/self-hosting' },
						{ label: 'Hosted (Vercel + Supabase)', slug: 'deploy/hosted' },
					],
				},
				{
					label: 'Features',
					items: [
						{ label: 'Lists', slug: 'features/lists' },
						{ label: 'Items', slug: 'features/items' },
						{ label: 'Claims and reveal', slug: 'features/claims' },
						{ label: 'Received gifts', slug: 'features/received-gifts' },
						{ label: 'Purchased gifts', slug: 'features/purchased-gifts' },
						{ label: 'URL scraping', slug: 'features/scraping' },
						{ label: 'Suggestions (AI)', slug: 'features/suggestions-ai' },
					],
				},
				{
					label: 'Permissions',
					items: [
						{ label: 'Overview', slug: 'permissions' },
						{ label: 'Guardians', slug: 'permissions/guardians' },
						{ label: 'Partners', slug: 'permissions/partners' },
						{ label: 'Dependents', slug: 'permissions/dependents' },
						{ label: 'Privacy', slug: 'permissions/privacy' },
					],
				},
				{
					label: 'Configuration',
					items: [
						{ label: 'Admin settings', slug: 'configuration/settings' },
						{ label: 'Environment variables', slug: 'configuration/environment-variables' },
						{ label: 'Authentication', slug: 'configuration/auth' },
						{ label: 'Emails', slug: 'configuration/emails' },
						{ label: 'Storage', slug: 'configuration/storage' },
						{ label: 'Scraping', slug: 'configuration/scraping' },
						{ label: 'AI provider', slug: 'configuration/ai' },
						{ label: 'Intelligence (AI)', slug: 'configuration/intelligence-ai' },
						{ label: 'Cron and scheduling', slug: 'configuration/cron' },
					],
				},
				{
					label: 'Changelog',
					items: [
						...makeChangelogsSidebarLinks([
							{
								type: 'latest',
								base: 'changelog',
								label: 'Latest version',
							},
							{
								type: 'all',
								base: 'changelog',
								label: 'All versions',
							},
						]),
					],
				},
			],
		}),
	],
})
