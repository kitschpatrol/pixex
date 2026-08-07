import type { DocumentInfo, ExportFormat, ExportOptions, LayerInfo, WebExportFormat } from '../lib'
import {
	bitsPerChannelFormats,
	compressionFactorFormats,
	exportFormatFromExtension,
	exportFormats,
	frameRateFormats,
	webExportFormatFromExtension,
	webExportFormats,
} from '../lib'

/**
 * A command-line usage problem, e.g. an option that doesn't apply to the chosen
 * format. Reported as a plain message and exit code 1, without a stack trace —
 * unlike unexpected errors, which are rethrown as bugs.
 */
export class UsageError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'UsageError'
	}
}

/**
 * Export option values collected from the command line. Options that don't
 * apply to the resolved format are rejected with a {@linkcode UsageError}.
 */
export type CliExportValues = {
	bitsPerChannel: number | undefined
	colorProfile: string | undefined
	compressionFactor: number | undefined
	frameRate: number | undefined
	timeoutMs: number | undefined
}

function includesFormat<T extends ExportFormat>(
	formats: readonly T[],
	format: ExportFormat,
): format is T {
	const widened: readonly ExportFormat[] = formats
	return widened.includes(format)
}

/**
 * Resolve the export format from an explicit option or the output file
 * extension, throwing a {@linkcode UsageError} when neither yields a format.
 */
export function resolveExportFormat(
	outputPath: string,
	explicitFormat: ExportFormat | undefined,
): ExportFormat {
	const format = explicitFormat ?? exportFormatFromExtension(outputPath)
	if (format === undefined) {
		throw new UsageError(
			`Cannot infer an export format from the extension of '${outputPath}' — pass --format with one of: ${exportFormats.join(', ')}`,
		)
	}

	return format
}

/**
 * Resolve the web export format from an explicit option or the output file
 * extension, throwing a {@linkcode UsageError} when neither yields a format.
 */
export function resolveWebExportFormat(
	outputPath: string,
	explicitFormat: undefined | WebExportFormat,
): WebExportFormat {
	const format = explicitFormat ?? webExportFormatFromExtension(outputPath)
	if (format === undefined) {
		throw new UsageError(
			`Cannot infer a web export format from the extension of '${outputPath}' — pass --format with one of: ${webExportFormats.join(', ')}`,
		)
	}

	return format
}

/**
 * Turn command-line export values into typed {@linkcode ExportOptions},
 * rejecting options that don't apply to the format.
 */
export function buildCliExportOptions(
	values: CliExportValues,
	format: ExportFormat,
): ExportOptions {
	const { bitsPerChannel, colorProfile, compressionFactor, frameRate, timeoutMs } = values

	if (compressionFactor !== undefined && !includesFormat(compressionFactorFormats, format)) {
		throw new UsageError(
			`--compression-factor does not apply to ${format} — only to ${compressionFactorFormats.join(', ')}`,
		)
	}

	if (bitsPerChannel !== undefined && !includesFormat(bitsPerChannelFormats, format)) {
		throw new UsageError(
			`--bits-per-channel does not apply to ${format} — only to ${bitsPerChannelFormats.join(', ')}`,
		)
	}

	if (frameRate !== undefined && !includesFormat(frameRateFormats, format)) {
		throw new UsageError(
			`--frame-rate does not apply to ${format} — only to ${frameRateFormats.join(', ')}`,
		)
	}

	const base = {
		...(colorProfile !== undefined && { colorProfile }),
		...(timeoutMs !== undefined && { timeoutMs }),
	}

	if (includesFormat(compressionFactorFormats, format)) {
		return { ...base, format, ...(compressionFactor !== undefined && { compressionFactor }) }
	}

	if (includesFormat(bitsPerChannelFormats, format)) {
		if (bitsPerChannel !== undefined && bitsPerChannel !== 8 && bitsPerChannel !== 16) {
			throw new UsageError('--bits-per-channel must be 8 or 16')
		}

		return { ...base, format, ...(bitsPerChannel !== undefined && { bitsPerChannel }) }
	}

	if (includesFormat(frameRateFormats, format)) {
		return { ...base, format, ...(frameRate !== undefined && { frameRate }) }
	}

	return { ...base, format }
}

/**
 * Render document properties as aligned human-readable key/value lines.
 */
export function renderDocumentInfo(info: DocumentInfo): string {
	const rows: Array<[string, string]> = [
		['name', info.name],
		['path', info.filePath ?? '(unsaved)'],
		['dimensions', `${info.width} × ${info.height} px`],
		['resolution', `${info.resolution} ppi`],
		['bits per channel', String(info.bitsPerChannel)],
		['color profile', info.colorProfile],
		['modified', info.isModified ? 'yes' : 'no'],
		['id', info.id],
	]
	const labelWidth = Math.max(...rows.map(([label]) => label.length))
	return `${rows.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`).join('\n')}\n`
}

function appendLayerLines(lines: string[], layers: readonly LayerInfo[], depth: number): void {
	const indent = '  '.repeat(depth)
	for (const layer of layers) {
		const annotations: string[] = []
		if (!layer.isVisible) {
			annotations.push('hidden')
		}

		if (layer.isLocked) {
			annotations.push('locked')
		}

		if (layer.opacity !== 100) {
			annotations.push(`${layer.opacity}% opacity`)
		}

		const suffix = annotations.length > 0 ? `  ${annotations.join(', ')}` : ''
		lines.push(`${indent}${layer.name} (${layer.type})${suffix}`)

		for (const mask of layer.masks) {
			lines.push(`${indent}  mask: ${mask.name}${mask.isVisible ? '' : '  disabled'}`)
		}

		if (layer.type === 'group') {
			appendLayerLines(lines, layer.children, depth + 1)
		}
	}
}

/**
 * Render a layer tree as an indented human-readable outline, annotating type,
 * visibility, lock state, non-default opacity, and masks.
 */
export function renderLayerTree(layers: readonly LayerInfo[]): string {
	const lines: string[] = []
	appendLayerLines(lines, layers, 0)
	return `${lines.join('\n')}\n`
}
