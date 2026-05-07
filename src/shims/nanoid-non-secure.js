// Shim: ship nanoid/non-secure inline with a default export.
// Astro 6.3.0 + Starlight 0.39.0 generates `import x from 'nanoid/non-secure'`
// in the prerender chunk (postcss CJS interop), which breaks against pure-ESM
// nanoid (3.x and 5.x both expose named-only exports). This file is aliased
// in astro.config.mjs to satisfy that default import.

const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

export const customAlphabet = (alphabet, defaultSize = 21) => {
	return (size = defaultSize) => {
		let id = ''
		let i = size | 0
		while (i--) {
			id += alphabet[(Math.random() * alphabet.length) | 0]
		}
		return id
	}
}

export const nanoid = (size = 21) => {
	let id = ''
	let i = size | 0
	while (i--) {
		id += urlAlphabet[(Math.random() * 64) | 0]
	}
	return id
}

export default { customAlphabet, nanoid }
