/**
 * Regenerate test/fixtures/kitchen-sink.pxd by driving Pixelmator Pro over JXA.
 * Run manually with `pnpm fixture:generate` (requires Pixelmator Pro and macOS
 * automation permission), then commit the result.
 *
 * The script is self-contained — it does not import from src/lib because Node's
 * native type stripping cannot resolve the library's extensionless imports. It
 * uses the same injection-safe protocol as the library: a static JXA source
 * with all dynamic values passed through a JSON-encoded argv parameter.
 *
 * The resulting document is 800×600 and contains, from a known seed:
 *
 * - 'Swatch' — an image layer (128×128 red square) with a reveal-all layer mask
 * - 'Title Text' — a text layer reading 'Pixex'
 * - 'Hexagon' — a 6-sided polygon shape layer at 50% opacity
 * - 'Hidden Rectangle' — an invisible rounded rectangle shape layer
 * - 'Shape Group' — a group layer containing 'Grouped Shape A' and 'Grouped Shape
 *   B' rounded rectangle shape layers
 */

import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

// A 1x1 red PNG (hex-encoded) — the smallest possible seed for a new document
const SEED_PNG_HEX =
	'89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0500f000485018084a98c210000000049454e44ae426082'

function decodeHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2)
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
	}

	return bytes
}

const jxaSource = `function run(argv) {
	const params = JSON.parse(argv[0])
	const app = Application('Pixelmator Pro')

	const findByPath = () =>
		app.documents().find((candidate) => {
			try {
				const file = candidate.file()
				return file ? file.toString() === params.seedPath : false
			} catch (ignoredError) {
				return false
			}
		})
	let doc = app.open(Path(params.seedPath))
	for (let attempt = 0; attempt < 50 && !doc; attempt++) {
		doc = findByPath()
		if (!doc) {
			delay(0.1)
		}
	}
	if (!doc) {
		throw new Error('Pixelmator Pro did not open ' + params.seedPath)
	}
	doc.resizeImage({ width: 128, height: 128, algorithm: 'nearest' })
	doc.resizeCanvas({ width: 800, height: 600 })
	doc.layers()[0].name = 'Swatch'
	// A reveal-all (solid white) mask leaves the appearance unchanged while
	// giving tests a mask to enumerate and toggle
	doc.layers()[0].mask({ maskMode: 'reveal all' })

	const text = app.TextLayer({ textContent: 'Pixex' })
	doc.layers.push(text)
	text.name = 'Title Text'

	const hexagon = app.PolygonShapeLayer({ position: [400, 300], width: 150, height: 150, sides: 6 })
	doc.layers.push(hexagon)
	hexagon.name = 'Hexagon'
	hexagon.opacity = 50

	const hidden = doc.makeRectangle({ width: 120, height: 80 })
	hidden.name = 'Hidden Rectangle'
	hidden.visible = false

	const groupedA = doc.makeRectangle({ width: 60, height: 60 })
	groupedA.name = 'Grouped Shape A'
	const groupedB = doc.makeRectangle({ width: 40, height: 40 })
	groupedB.name = 'Grouped Shape B'
	const group = doc.makeGroup({ from: [groupedA, groupedB] })
	group.name = 'Shape Group'

	// Export (not the hidden 'save as new document' command, which triggers a
	// blocking sandbox consent dialog for destinations outside the app sandbox)
	doc.export({ to: Path(params.outputPath), as: 'Pixelmator Pro' })

	const summary = {
		height: doc.height(),
		layers: doc.layers().map((layer) => layer.name() + ' (' + layer.class() + ')'),
		width: doc.width(),
	}
	doc.close({ saving: 'no' })
	return JSON.stringify(summary, undefined, 1)
}`

const outputPath = path.resolve(import.meta.dirname, '../test/fixtures/kitchen-sink.pxd')
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'pixex-fixture-'))
const seedPath = path.join(temporaryDirectory, 'seed.png')
writeFileSync(seedPath, decodeHex(SEED_PNG_HEX))

execFile(
	'/usr/bin/osascript',
	['-l', 'JavaScript', '-e', jxaSource, JSON.stringify({ outputPath, seedPath })],
	{ timeout: 120_000 },
	(error, stdout, stderr) => {
		rmSync(temporaryDirectory, { force: true, recursive: true })
		if (error) {
			process.stderr.write(`Fixture generation failed: ${error.message}\n${stderr}\n`)
			process.exitCode = 1
			return
		}

		process.stdout.write(`Wrote ${outputPath}\n${stdout}\n`)
	},
)
