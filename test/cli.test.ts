import { execFile } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isPixelmatorProInstalled } from '../src/lib'

const cliPath = path.resolve(import.meta.dirname, '../dist/bin/cli.js')
const fixturePath = path.resolve(import.meta.dirname, 'fixtures/kitchen-sink.pxd')
const canRunIntegration = process.platform === 'darwin' && isPixelmatorProInstalled()

async function run(...args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
	return new Promise((resolve, reject) => {
		execFile('node', [cliPath, ...args], (error, stdout, stderr) => {
			if (error && error.code === undefined) {
				reject(new Error(error.message))
				return
			}

			resolve({ code: typeof error?.code === 'number' ? error.code : 0, stderr, stdout })
		})
	})
}

const VERSION_REGEX = /\d+\.\d+\.\d+/v

describe('cli', () => {
	it('should print version with --version', async () => {
		const { code, stdout } = await run('--version')
		expect(code).toBe(0)
		expect(stdout.trim()).toMatch(VERSION_REGEX)
	})

	it('should print help with --help', async () => {
		const { code, stdout } = await run('--help')
		expect(code).toBe(0)
		expect(stdout).toContain('--help')
		for (const command of ['info', 'layers', 'export', 'export-web']) {
			expect(stdout).toContain(command)
		}
	})

	it('should demand a command when run bare', async () => {
		const { code, stderr } = await run()
		expect(code).not.toBe(0)
		expect(stderr).toContain('Choose a command')
	})

	it('should reject unknown commands', async () => {
		const { code } = await run('no-such-command')
		expect(code).not.toBe(0)
	})

	it.each([
		['info', ['--json']],
		['layers', ['--json']],
		['export', ['--format', '--layers', '--compression-factor', '--bits-per-channel']],
		['export-web', ['--scale', '--layers', '--reduce-colors']],
	])('should list %s options in its help', async (command, options) => {
		const { code, stdout } = await run(command, '--help')
		expect(code).toBe(0)
		for (const option of options) {
			expect(stdout).toContain(option)
		}
	})

	it('should demand an output path for export', async () => {
		const { code } = await run('export', fixturePath)
		expect(code).not.toBe(0)
	})

	// The next cases fail during option resolution, before Pixelmator Pro is
	// ever contacted — so they run without the app installed.

	it('should require --format for an unknown output extension', async () => {
		const { code, stderr } = await run('export', fixturePath, 'out.xyz')
		expect(code).toBe(1)
		expect(stderr).toContain('--format')
	})

	it('should require --format for extensionless web export output', async () => {
		const { code, stderr } = await run('export-web', fixturePath, 'out')
		expect(code).toBe(1)
		expect(stderr).toContain('--format')
	})

	it('should reject options that do not apply to the format', async () => {
		const { code, stderr } = await run('export', fixturePath, 'out.jpg', '--bits-per-channel', '8')
		expect(code).toBe(1)
		expect(stderr).toContain('--bits-per-channel does not apply to jpeg')
	})

	it('should reject --format values outside the known formats', async () => {
		const { code } = await run('export', fixturePath, 'out.png', '--format', 'tga')
		expect(code).not.toBe(0)
	})

	it('should reject a bare --layers flag without values', async () => {
		const { code } = await run('export', fixturePath, 'out.png', '--layers')
		expect(code).not.toBe(0)
	})
})

describe.runIf(canRunIntegration)('cli integration', () => {
	let workingDirectory: string
	let workingFixturePath: string

	beforeAll(() => {
		workingDirectory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pixex-cli-test-')))
		workingFixturePath = path.join(workingDirectory, 'kitchen-sink.pxd')
		cpSync(fixturePath, workingFixturePath)
	})

	afterAll(() => {
		rmSync(workingDirectory, { force: true, recursive: true })
	})

	function readPngWidth(filePath: string): number {
		const contents = readFileSync(filePath)
		// PNG IHDR width is a big-endian uint32 at byte 16
		return new DataView(contents.buffer, contents.byteOffset, contents.byteLength).getUint32(
			16,
			false,
		)
	}

	it('should export a PNG with valid magic bytes', async () => {
		const outputPath = path.join(workingDirectory, 'cli-export.png')
		const { code, stdout } = await run('export', workingFixturePath, outputPath)
		expect(code).toBe(0)
		expect(stdout).toBe('')
		expect(existsSync(outputPath)).toBe(true)
		expect([...readFileSync(outputPath).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
	}, 120_000)

	it('should export for web with scale as a percentage', async () => {
		const outputPath = path.join(workingDirectory, 'cli-web-half.png')
		const { code } = await run('export-web', workingFixturePath, outputPath, '--scale', '50')
		expect(code).toBe(0)
		expect(readPngWidth(outputPath)).toBe(400)
	}, 120_000)

	it('should solo layers with --layers without modifying the document', async () => {
		const fullPath = path.join(workingDirectory, 'cli-full.png')
		const soloPath = path.join(workingDirectory, 'cli-solo.png')
		const fixtureBefore = readFileSync(workingFixturePath)

		const full = await run('export', workingFixturePath, fullPath)
		expect(full.code).toBe(0)
		const solo = await run('export', workingFixturePath, soloPath, '--layers', 'Swatch')
		expect(solo.code).toBe(0)
		expect(readFileSync(soloPath).equals(readFileSync(fullPath))).toBe(false)
		expect(readFileSync(workingFixturePath).equals(fixtureBefore)).toBe(true)
	}, 240_000)

	it('should fail cleanly when a --layers target matches nothing', async () => {
		const outputPath = path.join(workingDirectory, 'cli-no-such-layer.png')
		const { code, stderr } = await run(
			'export',
			workingFixturePath,
			outputPath,
			'--layers',
			'No Such Layer',
		)
		expect(code).toBe(1)
		expect(stderr).toContain('No Such Layer')
		expect(existsSync(outputPath)).toBe(false)
	}, 120_000)

	it('should print document info as JSON', async () => {
		const { code, stdout } = await run('info', workingFixturePath, '--json')
		expect(code).toBe(0)
		const info: unknown = JSON.parse(stdout)
		expect(info).toMatchObject({ height: 600, name: 'kitchen-sink.pxd', width: 800 })
	}, 120_000)

	it('should print human-readable document info by default', async () => {
		const { code, stdout } = await run('info', workingFixturePath)
		expect(code).toBe(0)
		expect(stdout).toContain('800 × 600 px')
	}, 120_000)

	it('should print the layer tree as JSON', async () => {
		const { code, stdout } = await run('layers', workingFixturePath, '--json')
		expect(code).toBe(0)
		const layers: unknown = JSON.parse(stdout)
		expect(Array.isArray(layers)).toBe(true)
		expect(layers).toHaveLength(5)
	}, 120_000)

	it('should annotate the human-readable layer tree', async () => {
		const { code, stdout } = await run('layers', workingFixturePath)
		expect(code).toBe(0)
		expect(stdout).toContain('Swatch (image)')
		expect(stdout).toContain('mask: Mask')
		expect(stdout).toContain('Hidden Rectangle (shape)  hidden')
		expect(stdout).toContain('50% opacity')
		expect(stdout).toContain('  Grouped Shape A (shape)')
	}, 120_000)

	it('should report automation failures with the error code', async () => {
		const { code, stderr } = await run('info', path.join(workingDirectory, 'missing.pxd'))
		expect(code).toBe(1)
		expect(stderr).toContain('document-open-failed')
	}, 120_000)
})
