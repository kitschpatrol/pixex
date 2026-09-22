/**
 * Machine-readable categories for failures raised by pixex operations.
 */
export type PixexErrorCode =
	| 'app-not-installed'
	| 'automation-permission-denied'
	| 'document-not-found'
	| 'document-open-failed'
	| 'export-failed'
	| 'invalid-output'
	| 'jxa-error'
	| 'timeout'

/**
 * Diagnostic details captured from the underlying osascript invocation.
 */
export type PixexErrorDetails = {
	/** The AppleScript error number, e.g. -1743 for a permission denial. */
	errorNumber?: number
	stderr?: string
	stdout?: string
}

/**
 * Error thrown by every pixex operation. The `code` property identifies the
 * failure category; `details` carries raw osascript diagnostics when
 * available.
 */
export class PixexError extends Error {
	readonly code: PixexErrorCode
	readonly details: PixexErrorDetails

	constructor(code: PixexErrorCode, message: string, details: PixexErrorDetails = {}) {
		super(message)
		this.name = 'PixexError'
		this.code = code
		this.details = details
	}
}

type JxaFailure = {
	errorMessage: string
	errorNumber?: number
	stderr?: string
	stdout?: string
}

/**
 * Convert a raw JXA/osascript failure into a categorized {@linkcode PixexError}.
 * Error numbers and message fragments were captured empirically against
 * Pixelmator Pro 3.8 on macOS 15.
 */
export function mapJxaFailure(failure: JxaFailure): PixexError {
	const { errorMessage, errorNumber, stderr, stdout } = failure
	const details: PixexErrorDetails = {
		...(errorNumber !== undefined && { errorNumber }),
		...(stderr !== undefined && { stderr }),
		...(stdout !== undefined && { stdout }),
	}
	const lowercaseMessage = errorMessage.toLowerCase()

	if (
		errorNumber === -1743 ||
		lowercaseMessage.includes('not authorized') ||
		lowercaseMessage.includes('-1743')
	) {
		return new PixexError(
			'automation-permission-denied',
			'Automation access to Pixelmator Pro was denied. Approve it in System Settings → Privacy & Security → Automation, then try again.',
			details,
		)
	}

	if (errorNumber === -1728) {
		return new PixexError(
			'document-not-found',
			'The document is no longer open in Pixelmator Pro. It may have been closed or the application restarted — open it again.',
			details,
		)
	}

	return errorNumber === -2700 || lowercaseMessage.includes("application can't be found")
		? new PixexError(
				'app-not-installed',
				'Pixelmator Pro was not found on this Mac. Install it from pixelmator.com or the App Store.',
				details,
			)
		: new PixexError('jxa-error', `Pixelmator Pro scripting failed: ${errorMessage}`, details)
}
