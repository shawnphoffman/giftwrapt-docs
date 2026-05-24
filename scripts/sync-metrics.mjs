#!/usr/bin/env node
// Pulls observability/metrics-catalog.json from the main giftwrapt repo
// and inlines it as a Markdown table into the observability doc page
// between marker comments. Local sibling checkout first, falls back to
// GitHub raw. Idempotent: re-running with no upstream changes leaves
// the doc byte-identical. Mirrors scripts/sync-compose.mjs.
//
// Markers in MDX:
//   {/* metrics:start file=observability/metrics-catalog.json */}
//   {/* metrics:end */}

import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const docsDir = resolve(repoRoot, 'src/content/docs')

const GITHUB_RAW = 'https://raw.githubusercontent.com/shawnphoffman/giftwrapt/main'
const LOCAL_CANDIDATES = [resolve(repoRoot, '../core'), resolve(repoRoot, '../giftwrapt')]

const TARGETS = [resolve(docsDir, 'configuration/observability.mdx')]

const START = /\{\/\*\s*metrics:start\s+file=([^\s*]+)\s*\*\/\}/g
const END = '{/* metrics:end */}'

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
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
	return { body: await res.text(), source: url }
}

function renderTable(catalog) {
	const rows = catalog.map(m => {
		const labels = m.labels.length === 0 ? '_(none)_' : m.labels.map(l => `\`${l}\``).join(', ')
		return `| \`${m.name}\` | ${m.type} | ${labels} | ${m.help} |`
	})
	return ['| Metric | Type | Labels | Description |', '|---|---|---|---|', ...rows].join('\n')
}

async function syncFile(filePath) {
	const original = await readFile(filePath, 'utf8')
	const tasks = []
	for (const match of original.matchAll(START)) tasks.push({ relPath: match[1], marker: match[0] })
	if (!tasks.length) return false

	let next = original
	for (const { relPath, marker } of tasks) {
		const { body, source } = await fetchSource(relPath)
		const catalog = JSON.parse(body)
		const block = renderTable(catalog)
		const replacement = `${marker}\n${block}\n${END}`
		const re = new RegExp(`${escapeRegExp(marker)}[\\s\\S]*?${escapeRegExp(END)}`, 'g')
		next = next.replace(re, replacement)
		console.log(`  ${relPath} ← ${source}`)
	}
	if (next === original) return false
	await writeFile(filePath, next)
	return true
}

function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let changed = 0
for (const t of TARGETS) {
	console.log(`sync-metrics: ${t.replace(repoRoot + '/', '')}`)
	if (await syncFile(t)) changed++
}
console.log(`sync-metrics: ${changed} file(s) updated`)
