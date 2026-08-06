/**
 * Static JXA (JavaScript for Automation) sources executed via `osascript -l
 * JavaScript`. Scripts are string constants assembled from static parts only —
 * dynamic values always travel through the JSON-encoded argv parameter, never
 * through string interpolation, so no user input can alter script code.
 *
 * Protocol: each script's `run(argv)` parses `argv[0]` as JSON params and
 * returns a JSON string of either `{ ok: true, value }` or `{ ok: false,
 * errorMessage, errorNumber }`.
 */

function wrapScript(body: string): string {
	return (
		'function run(argv) {\n' +
		'\tconst params = JSON.parse(argv[0])\n' +
		'\ttry {\n' +
		"\t\tconst app = Application('Pixelmator Pro')\n" +
		'\t\tconst value = (() => {\n' +
		body +
		'\n\t\t})()\n' +
		'\t\treturn JSON.stringify({ ok: true, value })\n' +
		'\t} catch (error) {\n' +
		'\t\treturn JSON.stringify({\n' +
		'\t\t\tok: false,\n' +
		'\t\t\terrorMessage: String(error),\n' +
		"\t\t\terrorNumber: typeof error.errorNumber === 'number' ? error.errorNumber : undefined,\n" +
		'\t\t})\n' +
		'\t}\n' +
		'}\n'
	)
}

/**
 * Open a document from `params.filePath` and return its id and name.
 *
 * JXA's open() is known to return null when the document is already open in the
 * app (and occasionally due to timing), so this falls back to locating the
 * document by its file path, retrying briefly. `params.filePath` must be a
 * resolved real path — macOS reports files under /tmp as /private/tmp.
 */
export const openDocumentScript = wrapScript(`
	const findByPath = () =>
		app.documents().find((candidate) => {
			try {
				const file = candidate.file()
				return file ? file.toString() === params.filePath : false
			} catch (ignoredError) {
				return false
			}
		})
	let doc = app.open(Path(params.filePath))
	for (let attempt = 0; attempt < 50 && !doc; attempt++) {
		doc = findByPath()
		if (!doc) {
			delay(0.1)
		}
	}
	if (!doc) {
		throw new Error('Pixelmator Pro did not open ' + params.filePath)
	}
	return { id: doc.id(), name: doc.name() }
`)

/**
 * Read document properties for `params.documentId`.
 */
export const documentInfoScript = wrapScript(`
	const doc = app.documents.byId(params.documentId)
	let filePath
	try {
		const file = doc.file()
		filePath = file ? file.toString() : undefined
	} catch (ignoredError) {
		filePath = undefined
	}
	return {
		bitsPerChannel: doc.bitsPerChannel(),
		colorProfile: doc.colorProfile(),
		filePath,
		height: doc.height(),
		id: doc.id(),
		isModified: doc.modified(),
		name: doc.name(),
		resolution: doc.resolution(),
		width: doc.width(),
	}
`)

/**
 * Read the full recursive layer tree of `params.documentId` in a single
 * osascript round trip.
 */
export const layerTreeScript = wrapScript(`
	const doc = app.documents.byId(params.documentId)
	const describeLayer = (layer) => {
		const rawClass = layer.class()
		const info = {
			id: layer.id(),
			index: layer.index(),
			isLocked: layer.locked(),
			isVisible: layer.visible(),
			name: layer.name(),
			opacity: layer.opacity(),
			rawClass,
		}
		try {
			// The dictionary only exposes the topmost mask (verified against
			// 3.8) — buried masks of a multi-mask layer are unreachable
			const mask = layer.layerMask()
			if (mask) {
				info.masks = [
					{
						id: mask.id(),
						isVisible: mask.visible(),
						name: mask.name(),
						opacity: mask.opacity(),
					},
				]
			}
		} catch (ignoredError) {
			// Some layer classes may not support layer masks
		}
		if (rawClass === 'groupLayer') {
			info.children = layer.layers().map(describeLayer)
		}
		return info
	}
	return doc.layers().map(describeLayer)
`)

/**
 * Set the `visible` property of the layer or layer mask with `params.layerId`
 * (searched recursively) in `params.documentId`. Masks are not part of the
 * regular layer tree, so each layer's mask id is checked during the search.
 */
export const layerVisibilityScript = wrapScript(`
	const doc = app.documents.byId(params.documentId)
	const findLayer = (layers) => {
		for (const layer of layers) {
			if (layer.id() === params.layerId) {
				return layer
			}
			try {
				const mask = layer.layerMask()
				if (mask && mask.id() === params.layerId) {
					return mask
				}
			} catch (ignoredError) {
				// Some layer classes may not support layer masks
			}
			if (layer.class() === 'groupLayer') {
				const found = findLayer(layer.layers())
				if (found) {
					return found
				}
			}
		}
		return undefined
	}
	const layer = findLayer(doc.layers())
	if (!layer) {
		throw new Error('No layer or mask with id ' + params.layerId + ' in document')
	}
	layer.visible = params.isVisible
	return true
`)

/**
 * Export `params.documentId` to `params.outputPath` as `params.format` (a
 * Pixelmator Pro enumerator name), with optional `params.properties`.
 */
export const exportDocumentScript = wrapScript(`
	const doc = app.documents.byId(params.documentId)
	const exportArguments = { to: Path(params.outputPath), as: params.format }
	if (params.properties) {
		exportArguments.withProperties = params.properties
	}
	doc.export(exportArguments)
	return true
`)

/**
 * Export `params.documentId` for web to `params.outputPath` as `params.format`,
 * with optional `params.properties`.
 */
export const exportForWebScript = wrapScript(`
	const doc = app.documents.byId(params.documentId)
	const exportArguments = { to: Path(params.outputPath), as: params.format }
	if (params.properties) {
		exportArguments.withProperties = params.properties
	}
	doc.exportForWeb(exportArguments)
	return true
`)

/**
 * Close `params.documentId`, saving first when `params.shouldSave` is true.
 */
export const closeDocumentScript = wrapScript(`
	const doc = app.documents.byId(params.documentId)
	doc.close({ saving: params.shouldSave ? 'yes' : 'no' })
	return true
`)
