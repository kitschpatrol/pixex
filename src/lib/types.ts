/**
 * All export formats supported by Pixelmator Pro's File ▸ Export command, as
 * verified against the Pixelmator Pro 3.8 scripting dictionary.
 */
export const exportFormats = [
	'animatedGif',
	'animatedPng',
	'bmp',
	'gif',
	'hdrAvif',
	'hdrHeic',
	'hdrJpeg',
	'hdrPng',
	'heic',
	'jpeg',
	'jpeg2000',
	'motion',
	'mp4',
	'openExr',
	'pdf',
	'pixelmatorPro',
	'png',
	'psd',
	'quickTimeMovie',
	'svg',
	'tiff',
	'webp',
] as const

/**
 * A format accepted by {@linkcode ExportOptions}.
 */
export type ExportFormat = (typeof exportFormats)[number]

/**
 * All formats supported by Pixelmator Pro's File ▸ Export for Web command.
 */
export const webExportFormats = ['gif', 'jpeg', 'png', 'svg', 'webp'] as const

/**
 * A format accepted by {@linkcode WebExportOptions}.
 */
export type WebExportFormat = (typeof webExportFormats)[number]

/**
 * Options for exporting a document. The option set is discriminated by `format`
 * so that only options meaningful for the chosen format are accepted, mirroring
 * the applicability notes in the Pixelmator Pro scripting dictionary.
 */
export type ExportOptions = (
	| {
			/** Color depth in bits per channel. */
			bitsPerChannel?: 8 | 16
			format: 'hdrAvif' | 'hdrHeic' | 'hdrJpeg' | 'hdrPng' | 'openExr' | 'png' | 'tiff'
	  }
	| {
			/** Compression from 1 (smallest file) to 100 (highest quality). */
			compressionFactor?: number
			format: 'heic' | 'jpeg2000' | 'jpeg' | 'webp'
	  }
	| {
			format: 'animatedGif' | 'animatedPng' | 'motion' | 'mp4' | 'quickTimeMovie'
			/** Frame rate of the exported video or animated image. */
			frameRate?: number
	  }
	| {
			format: 'bmp' | 'gif' | 'pdf' | 'pixelmatorPro' | 'psd' | 'svg'
	  }
) & {
	/** Name of the color profile to embed, e.g. `'sRGB IEC61966-2.1'`. */
	colorProfile?: string
	/** Maximum time to wait for the export to finish. Defaults to 120 000 ms. */
	timeoutMs?: number
}

/**
 * Options for exporting a document optimized for the web.
 */
export type WebExportOptions = {
	/** Compression from 1 to 100. JPEG and WebP only. */
	compressionFactor?: number
	format: WebExportFormat
	/**
	 * Scale as a percentage of the original size — 50 exports at half size, 200
	 * at double size. Verified empirically against Pixelmator Pro 3.8.
	 */
	scale?: number
	/** Convert colors to sRGB and omit the color profile from the file. */
	shouldConvertToSrgb?: boolean
	/** Preserve transparency instead of flattening to white. PNG and GIF only. */
	shouldKeepTransparency?: boolean
	/** Export with an 8-bit (256 color) palette. PNG only. */
	shouldReduceColors?: boolean
	/** Apply advanced (slower, smaller) compression. PNG only. */
	shouldUseAdvancedCompression?: boolean
	/** Maximum time to wait for the export to finish. Defaults to 120 000 ms. */
	timeoutMs?: number
}

/**
 * Read-only facts about an open document.
 */
export type DocumentInfo = {
	bitsPerChannel: number
	colorProfile: string
	/** Absolute path of the document's file, or undefined if never saved. */
	filePath: string | undefined
	height: number
	id: string
	isModified: boolean
	name: string
	/** Resolution in pixels per inch. */
	resolution: number
	width: number
}

/**
 * Normalized layer categories. Shape subclasses (rectangle, polygon, star,
 * etc.) all normalize to `'shape'`; the exact scripting class is preserved in
 * {@linkcode LayerInfo}'s `rawClass`. `'unknown'` covers classes introduced by
 * future Pixelmator Pro versions.
 */
export type LayerType =
	'colorAdjustments' | 'effects' | 'group' | 'image' | 'shape' | 'text' | 'unknown' | 'video'

type LayerInfoBase = {
	id: string
	/** 1-based position within the containing document or group. */
	index: number
	isLocked: boolean
	isVisible: boolean
	name: string
	/** Opacity from 0 to 100. */
	opacity: number
	/** The JXA scripting class, e.g. `'polygonShapeLayer'`. */
	rawClass: string
}

/**
 * A node in a document's layer tree. Group layers carry their children; all
 * other layer types are leaves.
 */
export type LayerInfo =
	| (LayerInfoBase & { children: LayerInfo[]; type: 'group' })
	| (LayerInfoBase & { type: Exclude<LayerType, 'group'> })
