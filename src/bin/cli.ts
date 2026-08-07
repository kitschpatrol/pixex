#!/usr/bin/env node

import { log, setDefaultLogOptions } from 'lognow'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import type { WebExportOptions } from '../lib'
import { bin, version } from '../../package.json' with { type: 'json' }
import {
	exportFormats,
	getDocumentInfo,
	getDocumentLayers,
	PixelmatorDocument,
	PixexError,
	setLogger,
	webExportFormats,
} from '../lib'
import {
	buildCliExportOptions,
	renderDocumentInfo,
	renderLayerTree,
	resolveExportFormat,
	resolveWebExportFormat,
	UsageError,
} from './cli-utilities'

setLogger(log)

/**
 * Run a command handler, reporting expected failures (automation errors, usage
 * problems) as a clean message and exit code 1. Anything else is a bug and
 * rethrows with its stack trace.
 */
async function runCommand(operation: () => Promise<void>): Promise<void> {
	try {
		await operation()
	} catch (error) {
		if (error instanceof PixexError) {
			log.error(`${error.code}: ${error.message}`)
			process.exitCode = 1
			return
		}

		if (error instanceof UsageError) {
			log.error(error.message)
			process.exitCode = 1
			return
		}

		throw error
	}
}

/**
 * Open a document, optionally solo the given layers, run the export, and close
 * without saving — so the document on disk is never modified.
 */
async function exportWithSolo(
	inputPath: string,
	soloTargets: readonly string[] | undefined,
	operation: (document: PixelmatorDocument) => Promise<void>,
): Promise<void> {
	const document = await PixelmatorDocument.open(inputPath)
	try {
		if (soloTargets !== undefined) {
			await document.soloLayers(soloTargets)
		}

		await operation(document)
	} finally {
		try {
			await document.close({ shouldSave: false })
		} catch (closeError) {
			log.warn(`Failed to close ${inputPath} after export: ${String(closeError)}`)
		}
	}
}

const inputPositional = {
	demandOption: true,
	describe: 'Path to the Pixelmator Pro document',
	type: 'string',
} as const

const outputPositional = {
	demandOption: true,
	describe: 'Path of the exported file (its directory must exist)',
	type: 'string',
} as const

const jsonOption = {
	default: false,
	description: 'Output JSON instead of human-readable text',
	type: 'boolean',
} as const

const layersOption = {
	array: true,
	description:
		'Show only these layers (matched by name or id) for the export — targets, their ancestors, and their descendants stay visible, everything else is hidden. The document on disk is not modified.',
	requiresArg: true,
	type: 'string',
} as const

const timeoutOption = {
	description: 'Maximum milliseconds to wait for the export to finish',
	requiresArg: true,
	type: 'number',
} as const

const cliCommandName = Object.keys(bin).at(0)!
const yargsInstance = yargs(hideBin(process.argv))

await yargsInstance
	.scriptName(cliCommandName)
	.usage('$0 <command>')
	.option('verbose', {
		default: false,
		description: 'Run with verbose logging',
		type: 'boolean',
	})
	.middleware((argv) => {
		// Set log level globally based on verbose flag
		setDefaultLogOptions({ verbose: argv.verbose })
	})
	.command(
		'info <input>',
		"Print a document's properties.",
		(command) => command.positional('input', inputPositional).option('json', jsonOption),
		async (argv) => {
			await runCommand(async () => {
				const info = await getDocumentInfo(argv.input)
				process.stdout.write(
					argv.json ? `${JSON.stringify(info, undefined, 2)}\n` : renderDocumentInfo(info),
				)
			})
		},
	)
	.command(
		'layers <input>',
		"Print a document's layer tree, including layer ids and masks.",
		(command) => command.positional('input', inputPositional).option('json', jsonOption),
		async (argv) => {
			await runCommand(async () => {
				const layers = await getDocumentLayers(argv.input)
				process.stdout.write(
					argv.json ? `${JSON.stringify(layers, undefined, 2)}\n` : renderLayerTree(layers),
				)
			})
		},
	)
	.command(
		'export <input> <output>',
		'Export a document. The format is inferred from the output file extension unless --format is given.',
		(command) =>
			command
				.positional('input', inputPositional)
				.positional('output', outputPositional)
				.option('format', {
					choices: exportFormats,
					description: 'Export format (overrides the output file extension)',
					requiresArg: true,
				})
				.option('layers', layersOption)
				.option('compression-factor', {
					description:
						'Compression from 1 (smallest file) to 100 (highest quality); HEIC, JPEG, JPEG2000, and WebP only',
					requiresArg: true,
					type: 'number',
				})
				.option('bits-per-channel', {
					choices: [8, 16] as const,
					description:
						'Color depth in bits per channel; PNG, TIFF, OpenEXR, and the HDR formats only',
					requiresArg: true,
				})
				.option('frame-rate', {
					description: 'Frame rate of the exported file; video and animated formats only',
					requiresArg: true,
					type: 'number',
				})
				.option('color-profile', {
					description: "Name of the color profile to embed, e.g. 'sRGB IEC61966-2.1'",
					requiresArg: true,
					type: 'string',
				})
				.option('timeout', timeoutOption),
		async (argv) => {
			await runCommand(async () => {
				const format = resolveExportFormat(argv.output, argv.format)
				const options = buildCliExportOptions(
					{
						bitsPerChannel: argv.bitsPerChannel,
						colorProfile: argv.colorProfile,
						compressionFactor: argv.compressionFactor,
						frameRate: argv.frameRate,
						timeoutMs: argv.timeout,
					},
					format,
				)
				await exportWithSolo(argv.input, argv.layers, async (document) =>
					document.exportTo(argv.output, options),
				)
				log.debug(`Exported ${argv.output}`)
			})
		},
	)
	.command(
		'export-web <input> <output>',
		'Export a document optimized for the web. The format is inferred from the output file extension unless --format is given.',
		(command) =>
			command
				.positional('input', inputPositional)
				.positional('output', outputPositional)
				.option('format', {
					choices: webExportFormats,
					description: 'Export format (overrides the output file extension)',
					requiresArg: true,
				})
				.option('layers', layersOption)
				.option('scale', {
					description:
						'Scale as a percentage of the original size — 50 exports at half size, 200 at double size',
					requiresArg: true,
					type: 'number',
				})
				.option('compression-factor', {
					description:
						'Compression from 1 (smallest file) to 100 (highest quality); JPEG and WebP only',
					requiresArg: true,
					type: 'number',
				})
				.option('convert-to-srgb', {
					description: 'Convert colors to sRGB and omit the color profile from the file',
					type: 'boolean',
				})
				.option('keep-transparency', {
					description: 'Preserve transparency instead of flattening to white; PNG and GIF only',
					type: 'boolean',
				})
				.option('reduce-colors', {
					description: 'Export with an 8-bit (256 color) palette; PNG only',
					type: 'boolean',
				})
				.option('advanced-compression', {
					description: 'Apply advanced (slower, smaller) compression; PNG only',
					type: 'boolean',
				})
				.option('timeout', timeoutOption),
		async (argv) => {
			await runCommand(async () => {
				const format = resolveWebExportFormat(argv.output, argv.format)
				const options: WebExportOptions = {
					format,
					...(argv.compressionFactor !== undefined && {
						compressionFactor: argv.compressionFactor,
					}),
					...(argv.scale !== undefined && { scale: argv.scale }),
					...(argv.convertToSrgb !== undefined && { shouldConvertToSrgb: argv.convertToSrgb }),
					...(argv.keepTransparency !== undefined && {
						shouldKeepTransparency: argv.keepTransparency,
					}),
					...(argv.reduceColors !== undefined && { shouldReduceColors: argv.reduceColors }),
					...(argv.advancedCompression !== undefined && {
						shouldUseAdvancedCompression: argv.advancedCompression,
					}),
					...(argv.timeout !== undefined && { timeoutMs: argv.timeout }),
				}
				await exportWithSolo(argv.input, argv.layers, async (document) =>
					document.exportForWeb(argv.output, options),
				)
				log.debug(`Exported ${argv.output}`)
			})
		},
	)
	.demandCommand(1, 'Choose a command: info, layers, export, or export-web.')
	.alias('h', 'help')
	.version(version)
	.alias('v', 'version')
	.help()
	.strict()
	.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
	.parse()
