import type {
	ExportFormat,
	ExportOptions,
	LayerType,
	WebExportFormat,
	WebExportOptions,
} from './types'

/**
 * Maps pixex format identifiers to enumerator names in the Pixelmator Pro
 * scripting dictionary. JXA accepts the sdef enumerator names verbatim,
 * including two-word names — verified empirically against Pixelmator Pro 3.8.
 */
export const exportFormatToJxa: Record<ExportFormat, string> = {
	animatedGif: 'Animated GIF',
	animatedPng: 'Animated PNG',
	bmp: 'BMP',
	gif: 'GIF',
	hdrAvif: 'HDR AVIF',
	hdrHeic: 'HDR HEIC',
	hdrJpeg: 'HDR JPEG',
	hdrPng: 'HDR PNG',
	heic: 'HEIC',
	jpeg: 'JPEG',
	jpeg2000: 'JPEG2000',
	motion: 'Motion',
	mp4: 'MP4',
	openExr: 'OpenEXR',
	pdf: 'PDF',
	pixelmatorPro: 'Pixelmator Pro',
	png: 'PNG',
	psd: 'PSD',
	quickTimeMovie: 'QuickTime Movie',
	svg: 'SVG',
	tiff: 'TIFF',
	webp: 'WebP',
}

/**
 * Maps pixex web export format identifiers to enumerator names in the
 * Pixelmator Pro scripting dictionary.
 */
export const webExportFormatToJxa: Record<WebExportFormat, string> = {
	gif: 'GIF',
	jpeg: 'JPEG',
	png: 'PNG',
	svg: 'SVG',
	webp: 'WebP',
}

/**
 * Maps lowercase file extensions to export formats. Ambiguous extensions map to
 * the everyday variant — `.png` means `png`, not `hdrPng` or `animatedPng`. The
 * HDR, animated, and Motion formats are only reachable via an explicit format
 * option.
 */
const exportFormatByExtension: Record<string, ExportFormat> = {
	avif: 'hdrAvif',
	bmp: 'bmp',
	exr: 'openExr',
	gif: 'gif',
	heic: 'heic',
	jp2: 'jpeg2000',
	jpeg: 'jpeg',
	jpg: 'jpeg',
	mov: 'quickTimeMovie',
	mp4: 'mp4',
	pdf: 'pdf',
	png: 'png',
	psd: 'psd',
	pxd: 'pixelmatorPro',
	svg: 'svg',
	tif: 'tiff',
	tiff: 'tiff',
	webp: 'webp',
}

const webExportFormatByExtension: Record<string, WebExportFormat> = {
	gif: 'gif',
	jpeg: 'jpeg',
	jpg: 'jpeg',
	png: 'png',
	svg: 'svg',
	webp: 'webp',
}

function fileExtension(filePath: string): string {
	const lastSegment = filePath.split('/').at(-1) ?? filePath
	const dotIndex = lastSegment.lastIndexOf('.')
	return dotIndex > 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : ''
}

/**
 * Infer the export format from a file path's extension, or undefined when the
 * extension is missing or unrecognized. Ambiguous extensions resolve to the
 * everyday variant (`.png` → `'png'`, never `'hdrPng'` or `'animatedPng'`).
 */
export function exportFormatFromExtension(outputPath: string): ExportFormat | undefined {
	return exportFormatByExtension[fileExtension(outputPath)]
}

/**
 * Infer the web export format from a file path's extension, or undefined when
 * the extension is missing or unrecognized.
 */
export function webExportFormatFromExtension(outputPath: string): undefined | WebExportFormat {
	return webExportFormatByExtension[fileExtension(outputPath)]
}

/**
 * Formats that accept the `compressionFactor` export option.
 */
export const compressionFactorFormats = ['heic', 'jpeg', 'jpeg2000', 'webp'] as const

/**
 * Formats that accept the `bitsPerChannel` export option.
 */
export const bitsPerChannelFormats = [
	'hdrAvif',
	'hdrHeic',
	'hdrJpeg',
	'hdrPng',
	'openExr',
	'png',
	'tiff',
] as const

/**
 * Formats that accept the `frameRate` export option.
 */
export const frameRateFormats = [
	'animatedGif',
	'animatedPng',
	'motion',
	'mp4',
	'quickTimeMovie',
] as const

/**
 * Build the JXA `with properties` record for an export, or undefined when no
 * options are set. Keys are the camelCase spellings JXA derives from the sdef
 * (`compression factor` → `compressionFactor`, etc.).
 */
export function buildExportProperties(
	options: ExportOptions,
): Record<string, number | string> | undefined {
	const properties: Record<string, number | string> = {}

	if (options.colorProfile !== undefined) {
		properties.colorProfile = options.colorProfile
	}

	if ('compressionFactor' in options && options.compressionFactor !== undefined) {
		properties.compressionFactor = options.compressionFactor
	}

	if ('bitsPerChannel' in options && options.bitsPerChannel !== undefined) {
		properties.bitsPerChannel = options.bitsPerChannel
	}

	if ('frameRate' in options && options.frameRate !== undefined) {
		properties.frameRate = options.frameRate
	}

	return Object.keys(properties).length > 0 ? properties : undefined
}

/**
 * Build the JXA `with properties` record for a web export, or undefined when no
 * options are set. Boolean options are forwarded even when false, since false
 * is meaningful (e.g. discarding transparency).
 */
export function buildWebExportProperties(
	options: WebExportOptions,
): Record<string, boolean | number> | undefined {
	const properties: Record<string, boolean | number> = {}

	if (options.compressionFactor !== undefined) {
		properties.compressionFactor = options.compressionFactor
	}

	if (options.scale !== undefined) {
		properties.scale = options.scale
	}

	if (options.shouldConvertToSrgb !== undefined) {
		properties.convertToSRGB = options.shouldConvertToSrgb
	}

	if (options.shouldKeepTransparency !== undefined) {
		properties.keepTransparency = options.shouldKeepTransparency
	}

	if (options.shouldReduceColors !== undefined) {
		properties.reduceColors = options.shouldReduceColors
	}

	if (options.shouldUseAdvancedCompression !== undefined) {
		properties.advancedCompression = options.shouldUseAdvancedCompression
	}

	return Object.keys(properties).length > 0 ? properties : undefined
}

/**
 * Normalize a JXA layer scripting class (e.g. `'polygonShapeLayer'`) to a
 * {@linkcode LayerType}.
 */
export function layerTypeFromRawClass(rawClass: string): LayerType {
	switch (rawClass) {
		case 'colorAdjustmentsLayer': {
			return 'colorAdjustments'
		}

		case 'effectsLayer': {
			return 'effects'
		}

		case 'groupLayer': {
			return 'group'
		}

		case 'imageLayer': {
			return 'image'
		}

		case 'textLayer': {
			return 'text'
		}

		case 'videoLayer': {
			return 'video'
		}

		default: {
			return rawClass.toLowerCase().includes('shape') ? 'shape' : 'unknown'
		}
	}
}
