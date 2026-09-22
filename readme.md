<!-- title -->

# pixex

<!-- /title -->

<!-- badges -->

[![NPM Package pixex](https://img.shields.io/npm/v/pixex.svg)](https://www.npmjs.com/package/pixex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/license/mit)
[![CI](https://github.com/kitschpatrol/pixex/actions/workflows/ci.yml/badge.svg)](https://github.com/kitschpatrol/pixex/actions/workflows/ci.yml)

<!-- /badges -->

<!-- short-description -->

**Pixelmator Export. TypeScript library and CLI tool to automate layer composition and exports from Pixelmator Pro PXD files.**

<!-- /short-description -->

## Overview

Pixex automates image exports from [Pixelmator Pro](https://www.apple.com/pixelmator-pro/) documents on macOS.

It drives Pixelmator Pro's AppleScript dictionary via JXA (`osascript`), wrapped in strongly-typed TypeScript API.

It supports every format Pixelmator Pro can export (PNG, JPEG, WebP, HEIC, TIFF, PSD, PDF, SVG, and more), the web-optimized export pipeline, reading document and layer metadata, and setting layer visibility before export.

I use it in certain project asset pipelines where I need to export many layer permutations from a single file, and want to keep the PXD as the single point of truth.

I've only tested this with the "one-time purchase" version of Pixelmator Pro, I don't have the Creator Studio version (Pixelmator 4).

_This tool is so niche that I won't plaster a big warning up top, but please note that Pixex is still under development and neither its API nor its functionality should be considered stable until a 1.0 release._

## Getting started

### Dependencies

- macOS with [Pixelmator Pro](https://www.apple.com/pixelmator-pro/) ^3.8 installed
- Node.js 24.16+

The first invocation triggers a macOS Automation permission prompt. Approve it in System Settings → Privacy & Security → Automation.

### Installation

Install locally to access the CLI and API in a single project:

```sh
pnpm install pixex
```

Or install globally:

```sh
pnpm install --global pixex
```

The CLI tool is also available on Homebrew:

```sh
brew install kitschpatrol/tap/pixex
```

## Usage

### Library

#### API

The core is the `PixelmatorDocument` handle class. Open a document once, run any number of operations, then close it:

- `PixelmatorDocument.open(filePath)` — open a document and get a handle
- `document.getInfo()` — dimensions, resolution, color profile, bits per channel
- `document.getLayers()` — the full recursive layer tree (names, types, visibility, opacity, and each layer's masks)
- `document.setLayerVisibility(layerId, isVisible)` — show or hide layers, or enable/disable layer masks by mask id, e.g. for export permutations
- `document.soloLayers(targets)` — show only the given layers (matched by name or id): targets, their ancestors, and their descendants stay visible, everything else is hidden — one call per export permutation
- `document.exportTo(outputPath, options)` — export in any supported format
- `document.exportForWeb(outputPath, options)` — web-optimized export
- `document.close()` — release the document

Note on masks: Pixelmator Pro supports multiple masks per layer, but its scripting dictionary (as of 3.8) only exposes the topmost one — so `masks` never contains more than one entry, and only the topmost mask can be toggled. The field is an array so the API is ready if a future dictionary exposes the full mask stack.

One-shot wrappers (`exportDocument`, `exportDocumentForWeb`, `getDocumentInfo`, `getDocumentLayers`) open, act, and close in a single call.

If the target document is already open in Pixelmator Pro, pixex reuses it — and the one-shot wrappers and CLI then leave it open rather than closing your window and discarding unsaved changes. Check `document.wasAlreadyOpen` before calling `close()` yourself if you want the same courtesy.

All failures throw `PixexError` with a machine-readable `code` (`'app-not-installed'`, `'automation-permission-denied'`, `'document-not-found'`, `'export-failed'`, …).

#### Examples

```ts
import { exportDocument, PixelmatorDocument } from 'pixex'

// One-shot export
await exportDocument('artwork.pxd', 'artwork.jpg', { compressionFactor: 85, format: 'jpeg' })

// Multiple operations on one open document
const document = await PixelmatorDocument.open('artwork.pxd')
try {
  const info = await document.getInfo()
  console.log(`${info.width}×${info.height} @ ${info.resolution} ppi`)

  const layers = await document.getLayers()
  for (const layer of layers) {
    console.log(`${layer.name} (${layer.type}) visible: ${layer.isVisible}`)
  }

  await document.exportTo('artwork.png', { bitsPerChannel: 16, format: 'png' })
  await document.exportForWeb('artwork-small.webp', { format: 'webp', scale: 50 })

  // Export layer permutations — visibility changes are discarded when the
  // document is closed without saving, so the file on disk is untouched
  for (const variant of [
    ['Background', 'Logo'],
    ['Background', 'Logo Alt'],
  ]) {
    await document.soloLayers(variant)
    await document.exportTo(`artwork-${variant.at(-1)}.png`, { format: 'png' })
  }
} finally {
  await document.close()
}
```

### CLI

<!-- cli-help -->

```txt
pixex <command>

Commands:
  pixex info <input>                 Print a document's properties.
  pixex layers <input>               Print a document's layer tree, including layer ids and masks.
  pixex export <input> <output>      Export a document. The format is inferred from the output file extension unless --format is given.
  pixex export-web <input> <output>  Export a document optimized for the web. The format is inferred from the output file extension unless --format is given.

Options:
      --verbose  Run with verbose logging  [boolean] [default: false]
  -h, --help     Show help  [boolean]
  -v, --version  Show version number  [boolean]
```

<!-- /cli-help -->

#### Examples

```sh
# Inspect a document before deciding what to export
pixex info artwork.pxd
pixex layers artwork.pxd

# Export — the format is inferred from the output extension
pixex export artwork.pxd artwork.png
pixex export artwork.pxd artwork.jpg --compression-factor 85

# Pass --format when the extension is absent or ambiguous
pixex export artwork.pxd thumbnail --format png

# Web-optimized export at half size
pixex export-web artwork.pxd artwork-small.webp --scale 50

# Export only certain layers (the document on disk is not modified)
pixex export artwork.pxd logo-only.png --layers 'Background' 'Logo'

# Machine-readable output for scripting
pixex layers artwork.pxd --json
```

The commands print nothing on success — pass `--verbose` for progress logging. Failures report a machine-readable error code (e.g. `document-open-failed`) on stderr and exit 1.

Documents are opened, used, and closed without saving, so the file on disk is never modified. A document you already have open in Pixelmator Pro is reused and left open when the command finishes.

## Maintainers

[kitschpatrol](https://github.com/kitschpatrol)

<!-- contributing -->

## Contributing

[Issues](https://github.com/kitschpatrol/pixex/issues) are welcome and appreciated.

Please open an issue to discuss changes before submitting a pull request. Unsolicited PRs (especially AI-generated ones) are unlikely to be merged.

This repository uses [@kitschpatrol/shared-config](https://github.com/kitschpatrol/shared-config) (via its `ksc` CLI) for linting and formatting, plus [MDAT](https://github.com/kitschpatrol/mdat) for readme placeholder expansion.

<!-- /contributing -->

<!-- license -->

## License

[MIT](license.txt) © [Eric Mika](https://ericmika.com)

<!-- /license -->
