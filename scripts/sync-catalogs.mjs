#!/usr/bin/env node
// Pulls the generated catalogs from the main giftwrapt repo and inlines
// them as Markdown tables between marker comments, so these pages cannot
// drift from the code. Local sibling checkout first, falls back to GitHub
// raw. Idempotent. Mirrors scripts/sync-metrics.mjs.
//
// Markers in MDX:
//   {/* ai-features:start file=catalogs/ai-features.json */}
//   {/* ai-features:end */}
//   {/* mcp-tools:start file=catalogs/mcp-tools.json */}
//   {/* mcp-tools:end */}
//
// The catalogs are written in core by `pnpm docs:catalogs` and checked by
// core's tests. If a catalog cannot be fetched (offline, or core has not
// published it yet), the existing block is left as it is and the build
// carries on.

import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const docsDir = resolve(repoRoot, 'src/content/docs')

const GITHUB_RAW = 'https://raw.githubusercontent.com/shawnphoffman/giftwrapt/main'
const LOCAL_CANDIDATES = [resolve(repoRoot, '../core'), resolve(repoRoot, '../giftwrapt')]

const TARGETS = [resolve(docsDir, 'configuration/ai.mdx'), resolve(docsDir, 'features/ai-assistants.mdx')]

// Table cells: no raw pipes or newlines, and no characters MDX would parse.
function cell(text) {
	return String(text)
		.replace(/\s+/g, ' ')
		.replace(/\|/g, '\\|')
		.replace(/[{}<>]/g, c => `&#${c.charCodeAt(0)};`)
		.trim()
}

function sentence(text) {
	const t = cell(text)
	return /[.!?]$/.test(t) ? t : `${t}.`
}

const RENDERERS = {
	'ai-features': catalog => {
		const rows = catalog.map(
			f => `| **${cell(f.label)}** | ${f.sent.map(sentence).join(' ')} | ${f.neverSent.map(sentence).join(' ')} |`
		)
		return ['| Feature | Sent to the provider | Never sent |', '|---|---|---|', ...rows].join('\n')
	},
	'mcp-tools': catalog => {
		const rows = catalog.map(t => {
			const kind = [t.access === 'read' ? 'Reads' : t.destructive ? 'Changes (destructive)' : 'Changes', t.readsTheWeb ? 'reads the web' : '']
				.filter(Boolean)
				.join(', ')
			return `| \`${t.name}\` | ${kind} | ${cell(t.description)} |`
		})
		return ['| Tool | Kind | What it does |', '|---|---|---|', ...rows].join('\n')
	},
}

async function exists(p) {
	try {
		await access(p)
		return true
	} catch {
		return false
	}
}

async function fetchSource(relPath) {
	for (const root of LOCAL_CANDIDATES) {
		const p = resolve(root, relPath)
		if (await exists(p)) return { body: await readFile(p, 'utf8'), source: p }
	}
	const url = `${GITHUB_RAW}/${relPath}`
	const res = await fetch(url)
	if (!res.ok) throw new Error(`${url}: ${res.status}`)
	return { body: await res.text(), source: url }
}

function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function syncFile(filePath) {
	const original = await readFile(filePath, 'utf8')
	let next = original
	for (const [kind, render] of Object.entries(RENDERERS)) {
		const start = new RegExp(`\\{\\/\\*\\s*${kind}:start\\s+file=([^\\s*]+)\\s*\\*\\/\\}`, 'g')
		const end = `{/* ${kind}:end */}`
		for (const match of original.matchAll(start)) {
			const [marker, relPath] = match
			let block
			try {
				const { body, source } = await fetchSource(relPath)
				block = render(JSON.parse(body))
				console.log(`  ${relPath} ← ${source}`)
			} catch (err) {
				console.warn(`  ${relPath}: not synced (${err.message}); keeping the existing table`)
				continue
			}
			const re = new RegExp(`${escapeRegExp(marker)}[\\s\\S]*?${escapeRegExp(end)}`, 'g')
			next = next.replace(re, `${marker}\n${block}\n${end}`)
		}
	}
	if (next === original) return false
	await writeFile(filePath, next)
	return true
}

let changed = 0
for (const t of TARGETS) {
	console.log(`sync-catalogs: ${t.replace(repoRoot + '/', '')}`)
	if (await syncFile(t)) changed++
}
console.log(`sync-catalogs: ${changed} file(s) updated`)
