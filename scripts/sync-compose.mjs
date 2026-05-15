#!/usr/bin/env node
// Pulls docker-compose snippets from the main giftwrapt repo and inlines them
// into doc pages between marker comments. Tries a local sibling checkout first
// (../core/docker/<file> or ../giftwrapt/docker/<file>), falls back to fetching
// the raw file from GitHub on `main`. Idempotent: re-running with no upstream
// changes leaves the doc byte-identical.
//
// Markers in MDX look like:
//   {/* compose:start file=docker/compose.selfhost-garage-minimal.yaml */}
//   {/* compose:end */}
// Anything between them is replaced with a fenced ```yaml block on each run.

import { readFile, writeFile, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const docsDir = resolve(repoRoot, 'src/content/docs')

const GITHUB_RAW = 'https://raw.githubusercontent.com/shawnphoffman/giftwrapt/main'
const LOCAL_CANDIDATES = [resolve(repoRoot, '../core'), resolve(repoRoot, '../giftwrapt')]

const TARGETS = [resolve(docsDir, 'overview/getting-started.mdx'), resolve(docsDir, 'deploy/self-hosting.mdx')]

const START = /\{\/\*\s*compose:start\s+file=([^\s*]+)\s*\*\/\}/g
const END = '{/* compose:end */}'

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

async function syncFile(filePath) {
	const original = await readFile(filePath, 'utf8')
	const tasks = []
	for (const match of original.matchAll(START)) tasks.push({ relPath: match[1], marker: match[0] })
	if (!tasks.length) return false

	let next = original
	for (const { relPath, marker } of tasks) {
		const { body, source } = await fetchSource(relPath)
		const block = ['```yaml', `# Synced from ${relPath}`, body.trimEnd(), '```'].join('\n')
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
	console.log(`sync-compose: ${t.replace(repoRoot + '/', '')}`)
	if (await syncFile(t)) changed++
}
console.log(`sync-compose: ${changed} file(s) updated`)
