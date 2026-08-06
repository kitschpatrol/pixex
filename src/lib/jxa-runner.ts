import { execFile } from 'node:child_process'
import { mapJxaFailure, PixexError } from './errors'
import { isRecord } from './validate'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024

async function execFileAsync(
	command: string,
	args: string[],
	options: { maxBuffer: number; timeout: number },
): Promise<{ stderr: string; stdout: string }> {
	return new Promise((resolve, reject) => {
		execFile(command, args, options, (error, stdout, stderr) => {
			if (error) {
				const failure: Error & { stderr?: string; stdout?: string } = error
				failure.stderr = stderr
				failure.stdout = stdout
				reject(failure)
				return
			}

			resolve({ stderr, stdout })
		})
	})
}

/**
 * Options accepted by every osascript invocation.
 */
export type RunJxaOptions = {
	/** Maximum time to wait for the operation to finish. Defaults to 120 000 ms. */
	timeoutMs?: number
}

function execFailureToPixexError(error: unknown, timeoutMs: number): PixexError {
	if (!isRecord(error)) {
		return new PixexError('jxa-error', `osascript failed: ${String(error)}`)
	}

	const stderr = typeof error.stderr === 'string' ? error.stderr : undefined
	const stdout = typeof error.stdout === 'string' ? error.stdout : undefined

	if (error.killed === true) {
		return new PixexError('timeout', `osascript timed out after ${timeoutMs} ms`, {
			...(stderr !== undefined && { stderr }),
			...(stdout !== undefined && { stdout }),
		})
	}

	const message = typeof error.message === 'string' ? error.message : JSON.stringify(error)
	const errorMessage = stderr !== undefined && stderr.trim().length > 0 ? stderr.trim() : message
	return mapJxaFailure({
		errorMessage,
		...(stderr !== undefined && { stderr }),
		...(stdout !== undefined && { stdout }),
	})
}

/**
 * Execute a JXA script from `jxa-scripts.ts` via `/usr/bin/osascript`, passing
 * `params` as a single JSON-encoded argv argument, and return the script's
 * `value` payload. Throws {@linkcode PixexError} on any failure.
 */
export async function runJxa(
	script: string,
	params: unknown,
	options: RunJxaOptions = {},
): Promise<unknown> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
	let stdout: string

	try {
		const result = await execFileAsync(
			'/usr/bin/osascript',
			['-l', 'JavaScript', '-e', script, JSON.stringify(params)],
			{ maxBuffer: MAX_OUTPUT_BYTES, timeout: timeoutMs },
		)
		stdout = result.stdout
	} catch (error) {
		throw execFailureToPixexError(error, timeoutMs)
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(stdout)
	} catch {
		throw new PixexError('invalid-output', 'osascript returned output that is not valid JSON', {
			stdout,
		})
	}

	if (!isRecord(parsed) || typeof parsed.ok !== 'boolean') {
		throw new PixexError('invalid-output', 'osascript returned JSON without the ok/value shape', {
			stdout,
		})
	}

	if (parsed.ok) {
		return parsed.value
	}

	throw mapJxaFailure({
		errorMessage:
			typeof parsed.errorMessage === 'string' ? parsed.errorMessage : 'Unknown JXA error',
		...(typeof parsed.errorNumber === 'number' && { errorNumber: parsed.errorNumber }),
	})
}
