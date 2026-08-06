import { describe, expect, it } from 'vitest'
import { PixexError } from '../src/lib/errors'
import { runJxa } from '../src/lib/jxa-runner'

async function captureError(promise: Promise<unknown>): Promise<PixexError> {
	try {
		await promise
	} catch (error) {
		expect(error).toBeInstanceOf(PixexError)
		if (error instanceof PixexError) {
			return error
		}
	}

	throw new Error('Expected the promise to reject with a PixexError')
}

// These tests execute /usr/bin/osascript with self-contained scripts that
// never talk to Pixelmator Pro, so they run on any Mac but not in Linux CI.
describe.runIf(process.platform === 'darwin')('runJxa', () => {
	it('should round-trip params through the JSON argv protocol', async () => {
		const script = `function run(argv) {
			const params = JSON.parse(argv[0])
			return JSON.stringify({ ok: true, value: { echoed: params, sum: params.a + params.b } })
		}`
		const value = await runJxa(script, { a: 1, b: 2, text: 'café "quoted" $par' })
		expect(value).toEqual({
			echoed: { a: 1, b: 2, text: 'café "quoted" $par' },
			sum: 3,
		})
	})

	it('should map an in-script failure through mapJxaFailure', async () => {
		const script = `function run(argv) {
			return JSON.stringify({ ok: false, errorMessage: "Error: Can't get object.", errorNumber: -1728 })
		}`
		const error = await captureError(runJxa(script, {}))
		expect(error.code).toBe('document-not-found')
	})

	it('should throw invalid-output for non-JSON output', async () => {
		const script = `function run(argv) { return 'certainly not json' }`
		const error = await captureError(runJxa(script, {}))
		expect(error.code).toBe('invalid-output')
	})

	it('should throw invalid-output for JSON without the protocol shape', async () => {
		const script = `function run(argv) { return JSON.stringify({ unrelated: true }) }`
		const error = await captureError(runJxa(script, {}))
		expect(error.code).toBe('invalid-output')
	})

	it('should throw timeout when the script exceeds timeoutMs', async () => {
		const script = `function run(argv) { delay(10); return JSON.stringify({ ok: true }) }`
		const error = await captureError(runJxa(script, {}, { timeoutMs: 500 }))
		expect(error.code).toBe('timeout')
	}, 10_000)

	it('should map a script-level syntax error to jxa-error with stderr details', async () => {
		const error = await captureError(runJxa('this is not valid javascript', {}))
		expect(error.code).toBe('jxa-error')
		expect(error.details.stderr).toBeDefined()
	})
})
