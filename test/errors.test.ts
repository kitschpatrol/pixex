import { describe, expect, it } from 'vitest'
import { mapJxaFailure, PixexError } from '../src/lib/errors'

describe('PixexError', () => {
	it('should expose code, message, and details', () => {
		const error = new PixexError('export-failed', 'boom', { errorNumber: -100 })
		expect(error).toBeInstanceOf(Error)
		expect(error.name).toBe('PixexError')
		expect(error.code).toBe('export-failed')
		expect(error.message).toBe('boom')
		expect(error.details.errorNumber).toBe(-100)
	})

	it('should default details to an empty object', () => {
		expect(new PixexError('jxa-error', 'boom').details).toEqual({})
	})
})

describe('mapJxaFailure', () => {
	// Error payloads below were captured from real osascript runs against
	// Pixelmator Pro 3.8 during the terminology spike.

	it('should map -1743 to automation-permission-denied with remediation', () => {
		const error = mapJxaFailure({
			errorMessage: 'Error: An error occurred.',
			errorNumber: -1743,
		})
		expect(error.code).toBe('automation-permission-denied')
		expect(error.message).toContain('System Settings')
	})

	it('should map a "Not authorized" stderr message without a number', () => {
		const error = mapJxaFailure({
			errorMessage:
				'execution error: Error: Not authorized to send Apple events to Pixelmator Pro. (-1743)',
		})
		expect(error.code).toBe('automation-permission-denied')
	})

	it('should map -1728 to document-not-found', () => {
		const error = mapJxaFailure({
			errorMessage: "Error: Can't get object.",
			errorNumber: -1728,
		})
		expect(error.code).toBe('document-not-found')
	})

	it('should map -2700 and app-not-found text to app-not-installed', () => {
		expect(
			mapJxaFailure({
				errorMessage: "Error: Application can't be found.",
				errorNumber: -2700,
			}).code,
		).toBe('app-not-installed')
		expect(
			mapJxaFailure({
				errorMessage: "execution error: Error: Error: Application can't be found. (-2700)",
			}).code,
		).toBe('app-not-installed')
	})

	it('should map everything else to jxa-error and preserve details', () => {
		const error = mapJxaFailure({
			errorMessage:
				'Error: The operation couldn’t be completed. (com.pixelmatorteam.PTImageIO.ErrorDomain error 2001.)',
			errorNumber: -100,
			stderr: 'some stderr',
			stdout: 'some stdout',
		})
		expect(error.code).toBe('jxa-error')
		expect(error.message).toContain('PTImageIO')
		expect(error.details).toEqual({
			errorNumber: -100,
			stderr: 'some stderr',
			stdout: 'some stdout',
		})
	})
})
