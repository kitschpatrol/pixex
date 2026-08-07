import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import type { PixexErrorCode } from './errors'
import type { RunJxaOptions } from './jxa-runner'
import type { DocumentInfo, ExportOptions, LayerInfo, MaskInfo, WebExportOptions } from './types'
import { PixexError } from './errors'
import {
	buildExportProperties,
	buildWebExportProperties,
	exportFormatToJxa,
	layerTypeFromRawClass,
	webExportFormatToJxa,
} from './formats'
import { runJxa } from './jxa-runner'
import {
	closeDocumentScript,
	documentInfoScript,
	exportDocumentScript,
	exportForWebScript,
	layerTreeScript,
	layerVisibilityScript,
	openDocumentScript,
	soloLayersScript,
} from './jxa-scripts'
import {
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from './validate'

/**
 * Options for closing a document.
 */
export type CloseDocumentOptions = {
	/** Save pending changes before closing. Defaults to false. */
	shouldSave?: boolean
	timeoutMs?: number
}

/**
 * Check whether Pixelmator Pro is installed in the system or user Applications
 * folder. Installations in nonstandard locations are not detected, although the
 * rest of the library still works with them.
 */
export function isPixelmatorProInstalled(): boolean {
	return [
		'/Applications/Pixelmator Pro.app',
		path.join(homedir(), 'Applications/Pixelmator Pro.app'),
	].some((appPath) => existsSync(appPath))
}

function contextualize(error: unknown, code: PixexErrorCode, prefix: string): PixexError {
	if (error instanceof PixexError) {
		// Only generic scripting failures get recoded; specific codes like
		// automation-permission-denied or document-not-found pass through.
		if (error.code === 'jxa-error') {
			return new PixexError(code, `${prefix}: ${error.message}`, error.details)
		}

		return error
	}

	return new PixexError(code, `${prefix}: ${String(error)}`)
}

function parseMaskInfo(value: unknown): MaskInfo {
	const record = expectRecord(value, 'mask info')
	return {
		id: expectString(record.id, 'mask id'),
		isVisible: expectBoolean(record.isVisible, 'mask isVisible'),
		name: expectString(record.name, 'mask name'),
		opacity: expectNumber(record.opacity, 'mask opacity'),
	}
}

function parseLayerInfo(value: unknown): LayerInfo {
	const record = expectRecord(value, 'layer info')
	const rawClass = expectString(record.rawClass, 'layer rawClass')
	const type = layerTypeFromRawClass(rawClass)
	const base = {
		id: expectString(record.id, 'layer id'),
		index: expectNumber(record.index, 'layer index'),
		isLocked: expectBoolean(record.isLocked, 'layer isLocked'),
		isVisible: expectBoolean(record.isVisible, 'layer isVisible'),
		masks:
			record.masks === undefined
				? []
				: expectArray(record.masks, 'layer masks').map((mask) => parseMaskInfo(mask)),
		name: expectString(record.name, 'layer name'),
		opacity: expectNumber(record.opacity, 'layer opacity'),
		rawClass,
	}

	if (type === 'group') {
		const children = expectArray(record.children ?? [], 'group children')
		return { ...base, children: children.map((child) => parseLayerInfo(child)), type }
	}

	return { ...base, type }
}

/**
 * A handle to a document open in Pixelmator Pro. Obtain one with
 * {@linkcode PixelmatorDocument.open}, run any number of operations against it,
 * then release it with {@linkcode PixelmatorDocument.close}.
 *
 * The handle stores the document's scripting id; if the document is closed in
 * the app or Pixelmator Pro restarts, subsequent calls throw a
 * {@linkcode PixexError} with code `document-not-found`.
 */
export class PixelmatorDocument {
	/** Absolute path of the file this handle was opened from. */
	readonly filePath: string
	/** Pixelmator Pro's scripting id for the open document. */
	readonly id: string

	private constructor(id: string, filePath: string) {
		this.id = id
		this.filePath = filePath
	}

	/**
	 * Open a document in Pixelmator Pro and return a handle to it. If the file is
	 * already open in the app, the existing document is reused — note that
	 * `close()` will then close the user's window.
	 */
	static async open(filePath: string, options: RunJxaOptions = {}): Promise<PixelmatorDocument> {
		const resolvedPath = path.resolve(filePath)
		if (!existsSync(resolvedPath)) {
			throw new PixexError('document-open-failed', `No file exists at ${resolvedPath}`)
		}

		// Resolve symlinks so the path matches what Pixelmator Pro reports,
		// e.g. /tmp/… is really /private/tmp/… on macOS
		const absolutePath = realpathSync(resolvedPath)

		try {
			const value = await runJxa(openDocumentScript, { filePath: absolutePath }, options)
			const record = expectRecord(value, 'open result')
			return new PixelmatorDocument(expectString(record.id, 'document id'), absolutePath)
		} catch (error) {
			throw contextualize(error, 'document-open-failed', `Failed to open ${absolutePath}`)
		}
	}

	/**
	 * Close the document. Discards unsaved changes unless `shouldSave` is true.
	 */
	async close(options: CloseDocumentOptions = {}): Promise<void> {
		await runJxa(
			closeDocumentScript,
			{ documentId: this.id, shouldSave: options.shouldSave ?? false },
			options,
		)
	}

	/**
	 * Export the document optimized for the web. The output directory must
	 * already exist.
	 */
	async exportForWeb(outputPath: string, options: WebExportOptions): Promise<void> {
		const absolutePath = path.resolve(outputPath)
		try {
			await runJxa(
				exportForWebScript,
				{
					documentId: this.id,
					format: webExportFormatToJxa[options.format],
					outputPath: absolutePath,
					properties: buildWebExportProperties(options),
				},
				options,
			)
		} catch (error) {
			throw contextualize(error, 'export-failed', `Failed to export for web to ${absolutePath}`)
		}
	}

	/**
	 * Export the document to a file. The output directory must already exist.
	 */
	async exportTo(outputPath: string, options: ExportOptions): Promise<void> {
		const absolutePath = path.resolve(outputPath)
		try {
			await runJxa(
				exportDocumentScript,
				{
					documentId: this.id,
					format: exportFormatToJxa[options.format],
					outputPath: absolutePath,
					properties: buildExportProperties(options),
				},
				options,
			)
		} catch (error) {
			throw contextualize(error, 'export-failed', `Failed to export to ${absolutePath}`)
		}
	}

	/**
	 * Read the document's properties.
	 */
	async getInfo(options: RunJxaOptions = {}): Promise<DocumentInfo> {
		const value = await runJxa(documentInfoScript, { documentId: this.id }, options)
		const record = expectRecord(value, 'document info')
		return {
			bitsPerChannel: expectNumber(record.bitsPerChannel, 'document bitsPerChannel'),
			colorProfile: expectString(record.colorProfile, 'document colorProfile'),
			filePath: optionalString(record.filePath, 'document filePath'),
			height: expectNumber(record.height, 'document height'),
			id: expectString(record.id, 'document id'),
			isModified: expectBoolean(record.isModified, 'document isModified'),
			name: expectString(record.name, 'document name'),
			resolution: expectNumber(record.resolution, 'document resolution'),
			width: expectNumber(record.width, 'document width'),
		}
	}

	/**
	 * Read the document's full layer tree (one osascript round trip). Group
	 * layers include their children recursively.
	 */
	async getLayers(options: RunJxaOptions = {}): Promise<LayerInfo[]> {
		const value = await runJxa(layerTreeScript, { documentId: this.id }, options)
		return expectArray(value, 'layer list').map((layer) => parseLayerInfo(layer))
	}

	/**
	 * Show or hide a layer — or enable/disable a layer mask — by id, searched
	 * recursively through groups. Mask ids come from the `masks` field of
	 * {@linkcode PixelmatorDocument.getLayers} entries; hiding a mask disables its
	 * effect without deleting it, exactly like disabling it in the app. Only a
	 * layer's topmost mask is addressable — the scripting dictionary does not
	 * expose buried masks of a multi-mask layer. Useful for exporting visibility
	 * permutations of a document.
	 */
	async setLayerVisibility(
		layerId: string,
		isVisible: boolean,
		options: RunJxaOptions = {},
	): Promise<void> {
		await runJxa(layerVisibilityScript, { documentId: this.id, isVisible, layerId }, options)
	}

	/**
	 * Show only the given layers, matched by layer name or id. A layer stays
	 * visible if and only if it is a target, is inside a target (descendants of a
	 * soloed group must render), or contains a target (ancestors must render);
	 * every other layer is hidden. Masks are untouched. The whole tree is updated
	 * in a single osascript round trip, so this is much faster than per-layer
	 * {@linkcode PixelmatorDocument.setLayerVisibility} calls.
	 *
	 * Throws a {@linkcode PixexError} when a target matches nothing — in that case
	 * no visibility is changed. Combine with
	 * {@linkcode PixelmatorDocument.exportTo} and a non-saving
	 * {@linkcode PixelmatorDocument.close} to export visibility permutations
	 * without modifying the file on disk.
	 */
	async soloLayers(targets: readonly string[], options: RunJxaOptions = {}): Promise<void> {
		if (targets.length === 0) {
			throw new TypeError('soloLayers requires at least one target layer name or id')
		}

		await runJxa(soloLayersScript, { documentId: this.id, targets }, options)
	}
}
