# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-11-02

### Maintenance

- Raise the runtime logging dependency requirement from `lognow ^0.8.4` to `^0.8.7`.
- Refresh development dependencies, including shared-config 8.14, tsdown 0.23.4 and Vitest 5.0.5, upgrade pnpm to 12.16.1, and remove stale release-age exceptions.
- Update CI, release and repository-metadata actions and change dependency-update automation from weekly to monthly.
- Make link checks ignore loopback URLs and tolerate empty link sets.
- Build distributable files before linting or autofixing and simplify npm's published-file selection to `dist`.
- Replace the `skills` dependency and prepare hook with pnpm-managed skill synchronization into `.agents/skills` and `.claude/skills`.

## [0.2.1] - 2026-10-06

### Documentation

- Clarify macOS support and the exact Node.js requirement `^24.16.0 || >=26.3.0`, and update the Homebrew formula link.

### Maintenance

- Add weekly and manually triggered dependency-update pull-request automation.
- Set up contributor skill synchronization during package preparation and exclude generated agent files from version control and formatting.
- Update shared-config, brewpub, CLI-help tooling and pnpm, and inherit TypeScript file-selection defaults from the shared configuration.

## [0.2.0] - 2026-10-02

### Changed

- Replace regular and web export files only when rendered contents differ, preserving file identity and timestamps for identical output and retaining previous output if exporting fails.

### Documentation

- Explain unchanged-output preservation, including that exports still render each time and formats with changing embedded metadata may still replace files.
- Expand installation guidance for one-off npx usage, global npm or Homebrew installation, and library use.

### Maintenance

- Add regression tests for repeated exports, changed export settings, preservation of existing output after failures, and temporary-file cleanup.
- Refresh development dependencies and pnpm to 12.8.1, clean up dependency installation policies, and configure an ESLint 10 peer allowance.
- Pin release and repository-metadata actions to commit SHAs and correct error capture in website sitemap checks.

## [0.1.1] - 2026-09-21

### Added

- Make the CLI available through Homebrew with `brew install kitschpatrol/tap/pixex`.

### Documentation

- Expand installation instructions to cover local and global pnpm installs and Homebrew.

### Maintenance

- Update runtime dependency requirements to `lognow ^0.8.4` and `yargs ^18.2.0`.
- Refresh development dependencies, including shared-config and tsdown, migrate to Vitest 5 and pnpm 12, and update cleanup and npm publishing scripts.
- Improve website link checks with sitemap discovery and configuration loading, pin the sitemap crawler version, and update CI's pnpm setup action.
- Automate Homebrew formula updates after npm publication using brewpub.

## [0.1.0] - 2026-09-21

### Added

- Introduce an npm-installable ESM TypeScript library and `pixex` CLI for Pixelmator Pro 3.8 on macOS, requiring Node.js `^24.16.0 || >=26.3.0`.
- Manage documents through `PixelmatorDocument` and one-shot `exportDocument`, `exportDocumentForWeb`, `getDocumentInfo` and `getDocumentLayers` helpers. Closing discards changes unless saving is requested; `wasAlreadyOpen` identifies reused documents, which one-shot helpers and CLI commands leave open.
- Read document metadata and recursive, read-only layer snapshots with normalized types, visibility, opacity, lock state and topmost-mask information through the exported `DocumentInfo`, `LayerInfo` and `MaskInfo` types.
- Control layer and topmost-mask visibility by ID with `setLayerVisibility`, and select layers by name or ID with `soloLayers`, retaining required ancestors and descendants and rejecting unmatched targets before changing visibility.
- Support 22 export formats through `exportTo`, including raster, HDR, animation, video, SVG, PDF and layered documents, with typed compression, bit-depth, frame-rate and color-profile options.
- Add web-optimized GIF, JPEG, PNG, SVG and WebP exports with percentage scaling, compression, sRGB conversion, transparency controls, palette reduction and advanced PNG compression.
- Expose export-format lists, option-applicability tables, and `exportFormatFromExtension` and `webExportFormatFromExtension` helpers.
- Provide `PixexError` with machine-readable failure codes and scripting diagnostics, plus configurable operation timeouts. Expected CLI failures report errors on stderr and exit with status 1.
- Expose `isPixelmatorProInstalled()` for application detection and `setLogger()` for custom logging.
- Add `pixex info` and `pixex layers` commands with human-readable or `--json` output for document properties and nested layer trees, including masks.
- Add `pixex export` and `pixex export-web` with extension-based format inference, explicit `--format`, `--layers` selection, export settings and timeouts, plus help, version and verbose logging options.

### Documentation

- Document installation, macOS Automation permission setup, the library API, CLI usage and layer-permutation examples, including document-reuse behavior and mask limitations.

### Maintenance

- Set up bundled CLI and typed library builds, package validation, unit and Pixelmator integration tests, shared linting, macOS CI, link checks and release automation.

[0.1.0]: https://github.com/kitschpatrol/pixex/releases/tag/v0.1.0
[0.1.1]: https://github.com/kitschpatrol/pixex/compare/v0.1.0...v0.1.1
[0.2.0]: https://github.com/kitschpatrol/pixex/compare/v0.1.1...v0.2.0
[0.2.1]: https://github.com/kitschpatrol/pixex/compare/v0.2.0...v0.2.1
[0.2.2]: https://github.com/kitschpatrol/pixex/compare/v0.2.1...v0.2.2
