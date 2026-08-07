import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ExportFormat, ExportOptions, LayerInfo } from '../src/lib'
import {
	exportDocument,
	getDocumentInfo,
	getDocumentLayers,
	isPixelmatorProInstalled,
	PixelmatorDocument,
	PixexError,
} from '../src/lib'

const fixturePath = path.resolve(import.meta.dirname, 'fixtures/kitchen-sink.pxd')
const canRunIntegration = process.platform === 'darwin' && isPixelmatorProInstalled()

/**
 * Expected magic bytes per format, verified against real Pixelmator Pro 3.8
 * exports. HEIC and MP4-family formats are containers whose signature sits at
 * offset 4 (`ftyp`).
 */
const magicBytes: Partial<Record<ExportFormat, { anyOfBytes: number[][]; offset: number }>> = {
	bmp: { anyOfBytes: [[0x42, 0x4d]], offset: 0 },
	gif: { anyOfBytes: [[0x47, 0x49, 0x46, 0x38]], offset: 0 },
	heic: { anyOfBytes: [[0x66, 0x74, 0x79, 0x70]], offset: 4 },
	jpeg: { anyOfBytes: [[0xff, 0xd8, 0xff]], offset: 0 },
	jpeg2000: { anyOfBytes: [[0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50]], offset: 0 },
	openExr: { anyOfBytes: [[0x76, 0x2f, 0x31, 0x01]], offset: 0 },
	pdf: { anyOfBytes: [[0x25, 0x50, 0x44, 0x46]], offset: 0 },
	// .pxd is a zip archive
	pixelmatorPro: { anyOfBytes: [[0x50, 0x4b]], offset: 0 },
	png: { anyOfBytes: [[0x89, 0x50, 0x4e, 0x47]], offset: 0 },
	psd: { anyOfBytes: [[0x38, 0x42, 0x50, 0x53]], offset: 0 },
	// Pixelmator Pro 3.8 writes big-endian TIFF (MM), but accept either order
	tiff: {
		anyOfBytes: [
			[0x4d, 0x4d, 0x00, 0x2a],
			[0x49, 0x49, 0x2a, 0x00],
		],
		offset: 0,
	},
	webp: { anyOfBytes: [[0x52, 0x49, 0x46, 0x46]], offset: 0 },
}

// Motion, MP4, QuickTime, and the animated formats need video content, and
// the HDR formats depend on display hardware — all excluded from the matrix.
const exportMatrix: ExportOptions[] = [
	{ format: 'bmp' },
	{ format: 'gif' },
	{ format: 'heic' },
	{ format: 'jpeg' },
	{ format: 'jpeg2000' },
	{ format: 'openExr' },
	{ format: 'pdf' },
	{ format: 'pixelmatorPro' },
	{ format: 'png' },
	{ format: 'psd' },
	{ format: 'tiff' },
	{ format: 'webp' },
]

function expectMagicBytes(filePath: string, format: ExportFormat) {
	const expected = magicBytes[format]
	expect(expected).toBeDefined()
	if (expected === undefined) {
		return
	}

	const contents = readFileSync(filePath)
	expect(contents.length).toBeGreaterThan(0)
	const matchesSignature = expected.anyOfBytes.some((signature) =>
		signature.every((byte, index) => contents[expected.offset + index] === byte),
	)
	expect(matchesSignature, `unexpected magic bytes for ${format}`).toBe(true)
}

function readPngWidth(filePath: string): number {
	const contents = readFileSync(filePath)
	// PNG IHDR width is a big-endian uint32 at byte 16
	return new DataView(contents.buffer, contents.byteOffset, contents.byteLength).getUint32(
		16,
		false,
	)
}

function findLayer(layers: readonly LayerInfo[], name: string): LayerInfo | undefined {
	for (const layer of layers) {
		if (layer.name === name) {
			return layer
		}

		if (layer.type === 'group') {
			const found = findLayer(layer.children, name)
			if (found) {
				return found
			}
		}
	}

	return undefined
}

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

describe.runIf(canRunIntegration)('integration', () => {
	let workingDirectory: string
	let workingFixturePath: string
	let document: PixelmatorDocument

	beforeAll(async () => {
		// Work on a copy so the committed fixture can never be mutated. Resolve
		// the real path up front — macOS tmpdir() is a symlink under /private —
		// so paths reported back by Pixelmator Pro compare equal.
		workingDirectory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pixex-test-')))
		workingFixturePath = path.join(workingDirectory, 'kitchen-sink.pxd')
		cpSync(fixturePath, workingFixturePath)
		document = await PixelmatorDocument.open(workingFixturePath)
	}, 60_000)

	afterAll(async () => {
		try {
			await document.close({ shouldSave: false })
		} catch {
			// The close-behavior test may already have closed it
		}

		rmSync(workingDirectory, { force: true, recursive: true })
	}, 60_000)

	it('should read document info', async () => {
		const info = await document.getInfo()
		expect(info.width).toBe(800)
		expect(info.height).toBe(600)
		expect(info.name).toBe('kitchen-sink.pxd')
		expect(info.filePath).toBe(workingFixturePath)
		expect(info.id).toBe(document.id)
		expect(info.bitsPerChannel === 8 || info.bitsPerChannel === 16).toBe(true)
		expect(info.resolution).toBeGreaterThan(0)
		expect(info.colorProfile.length).toBeGreaterThan(0)
	})

	it('should read the recursive layer tree', async () => {
		const layers = await document.getLayers()
		expect(layers).toHaveLength(5)

		const swatch = findLayer(layers, 'Swatch')
		expect(swatch?.type).toBe('image')
		expect(swatch?.masks).toHaveLength(1)
		expect(swatch?.masks[0]?.name).toBe('Mask')
		expect(swatch?.masks[0]?.isVisible).toBe(true)

		const title = findLayer(layers, 'Title Text')
		expect(title?.type).toBe('text')

		const hexagon = findLayer(layers, 'Hexagon')
		expect(hexagon?.type).toBe('shape')
		expect(hexagon?.rawClass).toBe('polygonShapeLayer')
		expect(hexagon?.opacity).toBe(50)
		expect(hexagon?.masks).toEqual([])

		const hidden = findLayer(layers, 'Hidden Rectangle')
		expect(hidden?.isVisible).toBe(false)

		const group = findLayer(layers, 'Shape Group')
		expect(group?.type).toBe('group')
		const groupChildren = group?.type === 'group' ? group.children : []
		expect(groupChildren.map((child) => child.name).toSorted()).toEqual([
			'Grouped Shape A',
			'Grouped Shape B',
		])
	})

	it.each(exportMatrix)(
		'should export $format with valid magic bytes',
		async (options) => {
			const outputPath = path.join(workingDirectory, `export.${options.format}`)
			await document.exportTo(outputPath, options)
			expect(existsSync(outputPath)).toBe(true)
			expectMagicBytes(outputPath, options.format)
		},
		60_000,
	)

	it('should respect compression factor on JPEG exports', async () => {
		const lowPath = path.join(workingDirectory, 'low.jpg')
		const highPath = path.join(workingDirectory, 'high.jpg')
		await document.exportTo(lowPath, { compressionFactor: 10, format: 'jpeg' })
		await document.exportTo(highPath, { compressionFactor: 100, format: 'jpeg' })
		expect(readFileSync(highPath).length).toBeGreaterThan(readFileSync(lowPath).length)
	}, 120_000)

	it('should export 16 bits per channel PNG', async () => {
		const outputPath = path.join(workingDirectory, 'deep.png')
		await document.exportTo(outputPath, { bitsPerChannel: 16, format: 'png' })
		// PNG IHDR bit depth is the byte after the 4-byte height at byte 24
		expect(readFileSync(outputPath)[24]).toBe(16)
	}, 60_000)

	it.each(['gif', 'jpeg', 'png', 'svg', 'webp'] as const)(
		'should export %s for web',
		async (format) => {
			const outputPath = path.join(workingDirectory, `web.${format}`)
			await document.exportForWeb(outputPath, { format })
			expect(existsSync(outputPath)).toBe(true)
			expect(readFileSync(outputPath).length).toBeGreaterThan(0)
		},
		60_000,
	)

	it('should treat web export scale as a percentage', async () => {
		const outputPath = path.join(workingDirectory, 'web-half.png')
		await document.exportForWeb(outputPath, { format: 'png', scale: 50 })
		expect(readPngWidth(outputPath)).toBe(400)
	}, 60_000)

	it('should toggle layer visibility, including inside groups', async () => {
		const layers = await document.getLayers()
		const hidden = findLayer(layers, 'Hidden Rectangle')
		const nested = findLayer(layers, 'Grouped Shape B')
		expect(hidden).toBeDefined()
		expect(nested).toBeDefined()
		if (hidden === undefined || nested === undefined) {
			return
		}

		await document.setLayerVisibility(hidden.id, true)
		await document.setLayerVisibility(nested.id, false)
		const toggled = await document.getLayers()
		expect(findLayer(toggled, 'Hidden Rectangle')?.isVisible).toBe(true)
		expect(findLayer(toggled, 'Grouped Shape B')?.isVisible).toBe(false)

		// Restore so later tests and reruns see the committed state
		await document.setLayerVisibility(hidden.id, false)
		await document.setLayerVisibility(nested.id, true)
	}, 60_000)

	it('should enable and disable a layer mask via its id', async () => {
		const layers = await document.getLayers()
		const mask = findLayer(layers, 'Swatch')?.masks[0]
		expect(mask).toBeDefined()
		if (mask === undefined) {
			return
		}

		await document.setLayerVisibility(mask.id, false)
		const toggled = await document.getLayers()
		expect(findLayer(toggled, 'Swatch')?.masks[0]?.isVisible).toBe(false)

		// Restore the committed state
		await document.setLayerVisibility(mask.id, true)
		const restored = await document.getLayers()
		expect(findLayer(restored, 'Swatch')?.masks[0]?.isVisible).toBe(true)
	}, 60_000)

	it('should solo layers, keeping ancestors and descendants visible', async () => {
		await document.soloLayers(['Shape Group'])
		const soloed = await document.getLayers()
		expect(findLayer(soloed, 'Shape Group')?.isVisible).toBe(true)
		expect(findLayer(soloed, 'Grouped Shape A')?.isVisible).toBe(true)
		expect(findLayer(soloed, 'Grouped Shape B')?.isVisible).toBe(true)
		expect(findLayer(soloed, 'Swatch')?.isVisible).toBe(false)
		expect(findLayer(soloed, 'Title Text')?.isVisible).toBe(false)
		expect(findLayer(soloed, 'Hexagon')?.isVisible).toBe(false)
		expect(findLayer(soloed, 'Hidden Rectangle')?.isVisible).toBe(false)

		// Soloing a nested layer keeps its group ancestor visible but hides its sibling
		await document.soloLayers(['Grouped Shape A'])
		const nested = await document.getLayers()
		expect(findLayer(nested, 'Shape Group')?.isVisible).toBe(true)
		expect(findLayer(nested, 'Grouped Shape A')?.isVisible).toBe(true)
		expect(findLayer(nested, 'Grouped Shape B')?.isVisible).toBe(false)

		// Restore the committed state: everything visible except Hidden Rectangle
		await document.soloLayers(['Swatch', 'Title Text', 'Hexagon', 'Shape Group'])
		const restored = await document.getLayers()
		expect(findLayer(restored, 'Swatch')?.isVisible).toBe(true)
		expect(findLayer(restored, 'Hidden Rectangle')?.isVisible).toBe(false)
	}, 120_000)

	it('should reject unmatched solo targets without changing visibility', async () => {
		const before = await document.getLayers()
		const error = await captureError(document.soloLayers(['No Such Layer']))
		expect(error.code).toBe('jxa-error')
		expect(error.message).toContain('No Such Layer')
		expect(await document.getLayers()).toEqual(before)
	}, 60_000)

	it('should reject an empty solo target list', async () => {
		await expect(document.soloLayers([])).rejects.toThrow(TypeError)
	})

	it('should fail with export-failed for a nonexistent output directory', async () => {
		const error = await captureError(
			document.exportTo(path.join(workingDirectory, 'no-such-dir/out.png'), { format: 'png' }),
		)
		expect(error.code).toBe('export-failed')
	}, 60_000)

	it('should fail with document-open-failed for a nonexistent input', async () => {
		const error = await captureError(getDocumentInfo('/nonexistent/nope.pxd'))
		expect(error.code).toBe('document-open-failed')
	})

	it('should fail with document-not-found on a stale handle', async () => {
		const stalePath = path.join(workingDirectory, 'stale-copy.pxd')
		cpSync(fixturePath, stalePath)
		const staleDocument = await PixelmatorDocument.open(stalePath)
		await staleDocument.close()
		const error = await captureError(staleDocument.getInfo())
		expect(error.code).toBe('document-not-found')
	}, 60_000)

	it('should export via the one-shot wrapper', async () => {
		const oneShotFixture = path.join(workingDirectory, 'one-shot-copy.pxd')
		cpSync(fixturePath, oneShotFixture)
		const outputPath = path.join(workingDirectory, 'one-shot.png')
		await exportDocument(oneShotFixture, outputPath, { format: 'png' })
		expectMagicBytes(outputPath, 'png')

		const layers = await getDocumentLayers(oneShotFixture)
		expect(layers).toHaveLength(5)
	}, 120_000)
})
