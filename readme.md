<!-- title -->

# pixex

<!-- /title -->

<!-- badges -->

[![NPM Package pixex](https://img.shields.io/npm/v/pixex.svg)](https://www.npmjs.com/package/pixex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/license/mit)
[![CI](https://github.com/kitschpatrol/pixex/actions/workflows/ci.yml/badge.svg)](https://github.com/kitschpatrol/pixex/actions/workflows/ci.yml)

<!-- /badges -->

<!-- short-description -->

**CLI tool and TypeScript library to automate exports from Pixelmator PXD files.**

<!-- /short-description -->

## Overview

Pixex automates exports from [Pixelmator Pro](https://www.pixelmator.com/pro/) documents on macOS. It drives Pixelmator Pro's AppleScript dictionary via JXA (`osascript`), wrapped in strongly-typed async TypeScript functions — no manual AppleScript required.

It supports every format Pixelmator Pro can export (PNG, JPEG, WebP, HEIC, TIFF, PSD, PDF, SVG, and more), the web-optimized export pipeline, and reading document and layer metadata to decide what to export.

## Getting started

### Dependencies

- macOS with [Pixelmator Pro](https://www.pixelmator.com/pro/) 3.8 or later installed
- Node.js 24+

The first invocation triggers a macOS Automation permission prompt — approve it in System Settings → Privacy & Security → Automation.

### Installation

```sh
npm install pixex
```

## Usage

### Library

#### API

The core is the `PixelmatorDocument` handle class — open a document once, run any number of operations, then close it:

- `PixelmatorDocument.open(filePath)` — open a document and get a handle
- `document.getInfo()` — dimensions, resolution, color profile, bits per channel
- `document.getLayers()` — the full recursive layer tree (names, types, visibility, opacity, and each layer's masks)
- `document.setLayerVisibility(layerId, isVisible)` — show or hide layers, or enable/disable layer masks by mask id, e.g. for export permutations
- `document.exportTo(outputPath, options)` — export in any supported format
- `document.exportForWeb(outputPath, options)` — web-optimized export
- `document.close()` — release the document

Note on masks: Pixelmator Pro supports multiple masks per layer, but its scripting dictionary (as of 3.8) only exposes the topmost one — so `masks` never contains more than one entry, and only the topmost mask can be toggled. The field is an array so the API is ready if a future dictionary exposes the full mask stack.

One-shot wrappers (`exportDocument`, `exportDocumentForWeb`, `getDocumentInfo`, `getDocumentLayers`) open, act, and close in a single call.

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
} finally {
  await document.close()
}
```

### CLI

<!-- cli-help -->

#### Command: `pixex`

Run a pixex command.

This section lists top-level commands for `pixex`.

Usage:

```txt
pixex [command]
```

| Command     | Description                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `[default]` | Pixelmator Pro export automation. (CLI commands are coming soon — use the TypeScript API for now.) _(Default command.)_ |

| Option              | Description              | Type      | Default |
| ------------------- | ------------------------ | --------- | ------- |
| `--verbose`         | Run with verbose logging | `boolean` | `false` |
| `--help`<br>`-h`    | Show help                | `boolean` |         |
| `--version`<br>`-v` | Show version number      | `boolean` |         |

_See the sections below for more information on each subcommand._

<!-- /cli-help -->

#### Commands

#### Examples

## Background

### Motivation

### Implementation notes

### Similar projects

## The future

## Maintainers

_List maintainer(s) for a repository, along with one way of contacting them (e.g. GitHub link or email)._

## Acknowledgments

_State anyone or anything that significantly helped with the development of your project. State public contact hyper-links if applicable._

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
