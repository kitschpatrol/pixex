import { describe, expect, it } from 'vitest'
import * as scripts from '../src/lib/jxa-scripts'

const scriptEntries = Object.entries(scripts).filter(
	(entry): entry is [string, string] => typeof entry[1] === 'string',
)

describe('jxa scripts', () => {
	it('should export at least the seven operation scripts', () => {
		expect(scriptEntries.length).toBeGreaterThanOrEqual(7)
	})

	it.each(scriptEntries)('%s should follow the argv JSON protocol', (_name, script) => {
		expect(script).toContain('function run(argv)')
		expect(script).toContain('JSON.parse(argv[0])')
		expect(script).toContain("Application('Pixelmator Pro')")
		expect(script).toContain('JSON.stringify({ ok: true, value })')
		expect(script).toContain('errorMessage: String(error)')
	})

	it.each(scriptEntries)('%s should contain no template interpolation', (_name, script) => {
		// Dynamic values must only ever travel through the JSON argv parameter —
		// interpolation into script source would be an injection vector.
		expect(script).not.toContain('${')
	})
})
