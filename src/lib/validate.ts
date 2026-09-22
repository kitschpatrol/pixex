import { PixexError } from './errors'

/**
 * Narrow an unknown value to a plain record. Returns false for null-ish,
 * primitive, and array values.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && Boolean(value) && !Array.isArray(value)
}

function invalidOutput(context: string, value: unknown): PixexError {
	return new PixexError(
		'invalid-output',
		`Unexpected osascript output: ${context} was ${JSON.stringify(value)}`,
	)
}

/**
 * Assert that a value from the osascript JSON protocol is a record.
 */
export function expectRecord(value: unknown, context: string): Record<string, unknown> {
	if (!isRecord(value)) {
		throw invalidOutput(context, value)
	}

	return value
}

/**
 * Assert that a value from the osascript JSON protocol is an array.
 */
export function expectArray(value: unknown, context: string): unknown[] {
	if (!Array.isArray(value)) {
		throw invalidOutput(context, value)
	}

	return value
}

/**
 * Assert that a value from the osascript JSON protocol is a string.
 */
export function expectString(value: unknown, context: string): string {
	if (typeof value !== 'string') {
		throw invalidOutput(context, value)
	}

	return value
}

/**
 * Assert that a value from the osascript JSON protocol is a finite number.
 */
export function expectNumber(value: unknown, context: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw invalidOutput(context, value)
	}

	return value
}

/**
 * Assert that a value from the osascript JSON protocol is a boolean.
 */
export function expectBoolean(value: unknown, context: string): boolean {
	if (typeof value !== 'boolean') {
		throw invalidOutput(context, value)
	}

	return value
}

/**
 * Accept a string or an absent value (undefined, or null from JXA's missing
 * value) from the osascript JSON protocol.
 */
export function optionalString(value: unknown, context: string): string | undefined {
	return value === undefined || (typeof value === 'object' && !value)
		? undefined
		: expectString(value, context)
}
