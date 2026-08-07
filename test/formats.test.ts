import { describe, expect, it } from 'vitest'
import {
	bitsPerChannelFormats,
	buildExportProperties,
	buildWebExportProperties,
	compressionFactorFormats,
	exportFormatFromExtension,
	exportFormatToJxa,
	frameRateFormats,
	layerTypeFromRawClass,
	webExportFormatFromExtension,
	webExportFormatToJxa,
} from '../src/lib/formats'
import { exportFormats, webExportFormats } from '../src/lib/types'

describe('format mapping tables', () => {
	it('should map every export format to a JXA enumerator name', () => {
		for (const format of exportFormats) {
			expect(exportFormatToJxa[format]).toBeTypeOf('string')
			expect(exportFormatToJxa[format].length).toBeGreaterThan(0)
		}

		expect(Object.keys(exportFormatToJxa)).toHaveLength(exportFormats.length)
	})

	it('should map every web export format to a JXA enumerator name', () => {
		for (const format of webExportFormats) {
			expect(webExportFormatToJxa[format]).toBeTypeOf('string')
		}

		expect(Object.keys(webExportFormatToJxa)).toHaveLength(webExportFormats.length)
	})

	it('should use the spike-verified spellings for multi-word enumerators', () => {
		expect(exportFormatToJxa.pixelmatorPro).toBe('Pixelmator Pro')
		expect(exportFormatToJxa.animatedGif).toBe('Animated GIF')
		expect(exportFormatToJxa.hdrJpeg).toBe('HDR JPEG')
		expect(exportFormatToJxa.quickTimeMovie).toBe('QuickTime Movie')
		expect(exportFormatToJxa.jpeg2000).toBe('JPEG2000')
		expect(exportFormatToJxa.webp).toBe('WebP')
	})

	it('should keep option applicability tables within the known formats', () => {
		const applicabilityTables = [bitsPerChannelFormats, compressionFactorFormats, frameRateFormats]
		for (const table of applicabilityTables) {
			for (const format of table) {
				expect(exportFormats).toContain(format)
			}
		}
	})

	it('should not overlap compression and frame rate applicability', () => {
		for (const format of compressionFactorFormats) {
			expect(frameRateFormats).not.toContain(format)
		}
	})
})

describe('exportFormatFromExtension', () => {
	it('should map common extensions to their formats', () => {
		expect(exportFormatFromExtension('out.png')).toBe('png')
		expect(exportFormatFromExtension('out.jpg')).toBe('jpeg')
		expect(exportFormatFromExtension('out.jpeg')).toBe('jpeg')
		expect(exportFormatFromExtension('out.tif')).toBe('tiff')
		expect(exportFormatFromExtension('out.tiff')).toBe('tiff')
		expect(exportFormatFromExtension('out.jp2')).toBe('jpeg2000')
		expect(exportFormatFromExtension('out.pxd')).toBe('pixelmatorPro')
		expect(exportFormatFromExtension('out.exr')).toBe('openExr')
		expect(exportFormatFromExtension('out.mov')).toBe('quickTimeMovie')
		expect(exportFormatFromExtension('out.avif')).toBe('hdrAvif')
	})

	it('should resolve ambiguous extensions to the everyday variant', () => {
		expect(exportFormatFromExtension('out.png')).toBe('png')
		expect(exportFormatFromExtension('out.gif')).toBe('gif')
		expect(exportFormatFromExtension('out.heic')).toBe('heic')
	})

	it('should ignore case and directories', () => {
		expect(exportFormatFromExtension('out.PNG')).toBe('png')
		expect(exportFormatFromExtension('/some/dir.jpeg/out.WebP')).toBe('webp')
	})

	it('should return undefined for unknown or missing extensions', () => {
		expect(exportFormatFromExtension('out.xyz')).toBeUndefined()
		expect(exportFormatFromExtension('out')).toBeUndefined()
		expect(exportFormatFromExtension('.png')).toBeUndefined()
		expect(exportFormatFromExtension('/some/dir.jpeg/out')).toBeUndefined()
	})
})

describe('webExportFormatFromExtension', () => {
	it('should map every web format extension', () => {
		expect(webExportFormatFromExtension('out.gif')).toBe('gif')
		expect(webExportFormatFromExtension('out.jpg')).toBe('jpeg')
		expect(webExportFormatFromExtension('out.jpeg')).toBe('jpeg')
		expect(webExportFormatFromExtension('out.png')).toBe('png')
		expect(webExportFormatFromExtension('out.svg')).toBe('svg')
		expect(webExportFormatFromExtension('out.webp')).toBe('webp')
	})

	it('should return undefined for formats web export does not support', () => {
		expect(webExportFormatFromExtension('out.tiff')).toBeUndefined()
		expect(webExportFormatFromExtension('out.pxd')).toBeUndefined()
	})
})

describe('buildExportProperties', () => {
	it('should return undefined when no options are set', () => {
		expect(buildExportProperties({ format: 'png' })).toBeUndefined()
		expect(buildExportProperties({ format: 'pdf' })).toBeUndefined()
	})

	it('should include compression factor for lossy formats', () => {
		expect(buildExportProperties({ compressionFactor: 42, format: 'jpeg' })).toEqual({
			compressionFactor: 42,
		})
	})

	it('should include bits per channel and color profile', () => {
		expect(
			buildExportProperties({
				bitsPerChannel: 16,
				colorProfile: 'sRGB IEC61966-2.1',
				format: 'png',
			}),
		).toEqual({ bitsPerChannel: 16, colorProfile: 'sRGB IEC61966-2.1' })
	})

	it('should include frame rate for animated formats', () => {
		expect(buildExportProperties({ format: 'animatedGif', frameRate: 12.5 })).toEqual({
			frameRate: 12.5,
		})
	})
})

describe('buildWebExportProperties', () => {
	it('should return undefined when no options are set', () => {
		expect(buildWebExportProperties({ format: 'png' })).toBeUndefined()
	})

	it('should rename boolean options to the JXA property spellings', () => {
		expect(
			buildWebExportProperties({
				format: 'png',
				scale: 2,
				shouldConvertToSrgb: true,
				shouldKeepTransparency: false,
				shouldReduceColors: true,
				shouldUseAdvancedCompression: true,
			}),
		).toEqual({
			advancedCompression: true,
			convertToSRGB: true,
			keepTransparency: false,
			reduceColors: true,
			scale: 2,
		})
	})

	it('should forward explicit false values', () => {
		expect(buildWebExportProperties({ format: 'gif', shouldKeepTransparency: false })).toEqual({
			keepTransparency: false,
		})
	})

	it('should include compression factor', () => {
		expect(buildWebExportProperties({ compressionFactor: 60, format: 'jpeg' })).toEqual({
			compressionFactor: 60,
		})
	})
})

describe('layerTypeFromRawClass', () => {
	it('should map the concrete layer classes', () => {
		expect(layerTypeFromRawClass('imageLayer')).toBe('image')
		expect(layerTypeFromRawClass('textLayer')).toBe('text')
		expect(layerTypeFromRawClass('groupLayer')).toBe('group')
		expect(layerTypeFromRawClass('videoLayer')).toBe('video')
		expect(layerTypeFromRawClass('colorAdjustmentsLayer')).toBe('colorAdjustments')
		expect(layerTypeFromRawClass('effectsLayer')).toBe('effects')
	})

	it('should normalize all shape subclasses to shape', () => {
		for (const rawClass of [
			'shapeLayer',
			'rectangleShapeLayer',
			'roundedRectangleShapeLayer',
			'ellipseShapeLayer',
			'polygonShapeLayer',
			'starShapeLayer',
			'lineShapeLayer',
		]) {
			expect(layerTypeFromRawClass(rawClass)).toBe('shape')
		}
	})

	it('should fall back to unknown for unrecognized classes', () => {
		expect(layerTypeFromRawClass('holographicLayer')).toBe('unknown')
	})
})
