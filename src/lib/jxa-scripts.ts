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
 * Open a document from `params.filePath` and return its id, name, and whether
 * it was already open in the app (`wasAlreadyOpen` lets callers leave reused
 * documents open instead of closing the user's window).
 *
 * The document is looked up by path first, because JXA's open() is known to
 * return null when the document is already open (and occasionally due to
 * timing) — the post-open retry loop covers the timing case. `params.filePath`
 * must be a resolved real path — macOS reports files under /tmp as
 * /private/tmp.
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
	let doc = findByPath()
	const wasAlreadyOpen = Boolean(doc)
	if (!doc) {
		doc = app.open(Path(params.filePath))
	}
	for (let attempt = 0; attempt < 50 && !doc; attempt++) {
		doc = findByPath()
		if (!doc) {
			delay(0.1)
		}
	}
	if (!doc) {
		throw new Error('Pixelmator Pro did not open ' + params.filePath)
	}
	return { id: doc.id(), name: doc.name(), wasAlreadyOpen }
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
 * Solo the layers matching `params.targets` (an array of layer names or ids) in
 * `params.documentId`: a layer stays visible if and only if it is a target, is
 * inside a target (descendants of a soloed group must render), or contains a
 * target (ancestors must render); every other layer is hidden. Masks are
 * untouched. The whole tree is walked and updated in this single round trip.
 *
 * Visibility is computed for the entire tree before any layer is touched, so an
 * unmatched target aborts without modifying the document.
 */
export const soloLayersScript = wrapScript(`
	const doc = app.documents.byId(params.documentId)
	const matched = []
	const layerNames = []
	const isTarget = (layer) => {
		let isHit = false
		for (const key of [layer.name(), layer.id()]) {
			if (params.targets.includes(key)) {
				isHit = true
				if (!matched.includes(key)) {
					matched.push(key)
				}
			}
		}
		return isHit
	}
	const plans = []
	const walk = (layers, isInsideTarget) => {
		let hasTarget = false
		for (const layer of layers) {
			layerNames.push(layer.name())
			const isSelfTarget = isTarget(layer)
			let hasTargetDescendant = false
			if (layer.class() === 'groupLayer') {
				hasTargetDescendant = walk(layer.layers(), isInsideTarget || isSelfTarget)
			}
			plans.push({
				layer,
				isVisible: isInsideTarget || isSelfTarget || hasTargetDescendant,
			})
			hasTarget = hasTarget || isSelfTarget || hasTargetDescendant
		}
		return hasTarget
	}
	walk(doc.layers(), false)
	const unmatched = params.targets.filter((target) => !matched.includes(target))
	if (unmatched.length > 0) {
		throw new Error(
			'No layer named ' + unmatched.join(', ') +
			'. Layers in this document: ' + layerNames.join(', '),
		)
	}
	for (const plan of plans) {
		plan.layer.visible = plan.isVisible
	}
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
