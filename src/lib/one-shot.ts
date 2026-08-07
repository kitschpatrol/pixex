import type { RunJxaOptions } from './jxa-runner'
import type { DocumentInfo, ExportOptions, LayerInfo, WebExportOptions } from './types'
import { log } from './log'
import { PixelmatorDocument } from './pixelmator-document'

async function withDocument<T>(
	inputPath: string,
	options: RunJxaOptions,
	operation: (document: PixelmatorDocument) => Promise<T>,
): Promise<T> {
	const document = await PixelmatorDocument.open(inputPath, options)
	try {
		return await operation(document)
	} finally {
		if (document.wasAlreadyOpen) {
			// Closing would dismiss the user's own window and discard their
			// unsaved changes — leave documents we didn't open alone
			log.debug(`Leaving ${inputPath} open — it was already open in Pixelmator Pro`)
		} else {
			try {
				await document.close({ shouldSave: false })
			} catch (error) {
				// Never mask the operation's own error with a close failure
				log.warn(`Failed to close ${inputPath} after operation: ${String(error)}`)
			}
		}
	}
}

/**
 * Open a document, export it to a file, and close it again. A document that was
 * already open in Pixelmator Pro is reused and left open. For multiple
 * operations on the same document, use {@linkcode PixelmatorDocument} directly
 * to avoid reopening the file for every call.
 */
export async function exportDocument(
	inputPath: string,
	outputPath: string,
	options: ExportOptions,
): Promise<void> {
	await withDocument(inputPath, options, async (document) => document.exportTo(outputPath, options))
}

/**
 * Open a document, export it optimized for the web, and close it again. A
 * document that was already open in Pixelmator Pro is reused and left open.
 */
export async function exportDocumentForWeb(
	inputPath: string,
	outputPath: string,
	options: WebExportOptions,
): Promise<void> {
	await withDocument(inputPath, options, async (document) =>
		document.exportForWeb(outputPath, options),
	)
}

/**
 * Open a document, read its properties, and close it again. A document that was
 * already open in Pixelmator Pro is reused and left open.
 */
export async function getDocumentInfo(
	inputPath: string,
	options: RunJxaOptions = {},
): Promise<DocumentInfo> {
	return withDocument(inputPath, options, async (document) => document.getInfo(options))
}

/**
 * Open a document, read its full layer tree, and close it again. A document
 * that was already open in Pixelmator Pro is reused and left open.
 */
export async function getDocumentLayers(
	inputPath: string,
	options: RunJxaOptions = {},
): Promise<LayerInfo[]> {
	return withDocument(inputPath, options, async (document) => document.getLayers(options))
}
