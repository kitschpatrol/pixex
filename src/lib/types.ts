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

/**
 * A layer mask. Masks live outside the regular layer tree — they are only
 * reachable through the layer that owns them. `isVisible` reflects whether the
 * mask is enabled; pass the mask's `id` to
 * `PixelmatorDocument.setLayerVisibility` to enable or disable it.
 */
export type MaskInfo = {
	readonly id: string
	readonly isVisible: boolean
	readonly name: string
	/** Opacity from 0 to 100. */
	readonly opacity: number
}

type LayerInfoBase = {
	readonly id: string
	/** 1-based position within the containing document or group. */
	readonly index: number
	readonly isLocked: boolean
	readonly isVisible: boolean
	/**
	 * The layer's masks, outermost first. Empty when the layer has none.
	 *
	 * Limitation: although Pixelmator Pro supports multiple masks per layer, its
	 * scripting dictionary (as of 3.8) only exposes the topmost mask, so this
	 * array never contains more than one entry. Verified empirically — buried
	 * masks are unreachable by id, element collection, or chaining.
	 */
	readonly masks: readonly MaskInfo[]
	readonly name: string
	/** Opacity from 0 to 100. */
	readonly opacity: number
	/** The JXA scripting class, e.g. `'polygonShapeLayer'`. */
	readonly rawClass: string
}

/**
 * A node in a document's layer tree — a read-only snapshot taken when
 * `getLayers()` ran. Mutating it does not change the document; use
 * `PixelmatorDocument.setLayerVisibility` (with a layer or mask `id`) to make
 * changes in Pixelmator Pro. Group layers carry their children; all other layer
 * types are leaves.
 */
export type LayerInfo =
	| (LayerInfoBase & { readonly children: readonly LayerInfo[]; readonly type: 'group' })
	| (LayerInfoBase & { readonly type: Exclude<LayerType, 'group'> })
