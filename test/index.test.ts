import { describe, expect, it } from 'vitest'
import {
	exportDocument,
	exportDocumentForWeb,
	exportFormats,
	getDocumentInfo,
	getDocumentLayers,
	isPixelmatorProInstalled,
	PixelmatorDocument,
	PixexError,
	setLogger,
	webExportFormats,
} from '../src/lib'

describe('public API surface', () => {
	it('should export the document class and one-shot functions', () => {
		expect(PixelmatorDocument).toBeTypeOf('function')
		expect(exportDocument).toBeTypeOf('function')
		expect(exportDocumentForWeb).toBeTypeOf('function')
		expect(getDocumentInfo).toBeTypeOf('function')
		expect(getDocumentLayers).toBeTypeOf('function')
		expect(isPixelmatorProInstalled).toBeTypeOf('function')
		expect(setLogger).toBeTypeOf('function')
		expect(PixexError).toBeTypeOf('function')
	})

	it('should enumerate the known formats', () => {
		expect(exportFormats).toHaveLength(22)
		expect(webExportFormats).toHaveLength(5)
	})
})
