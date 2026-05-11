import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { defineCollection } from 'astro:content'
import { changelogsLoader } from 'starlight-changelogs/loader'

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	changelogs: defineCollection({
		loader: changelogsLoader([
			{
				provider: 'github',
				base: 'changelog',
				owner: 'shawnphoffman',
				repo: 'giftwrapt',
				process: ({ title }) => {
					// If the version title contains "-beta", filter it out.
					if (title.includes('-beta')) return

					return title
				},
			},
		]),
	}),
}
