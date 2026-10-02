import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportFile } from '../src/lib/export-file'

describe('exportFile', () => {
	let directory: string
	let outputPath: string

	beforeEach(() => {
		directory = mkdtempSync(path.join(tmpdir(), 'pixex-export-test-'))
		outputPath = path.join(directory, 'asset.png')
	})

	afterEach(() => {
		rmSync(directory, { force: true, recursive: true })
	})

	it('should create a missing output and remove temporary files', async () => {
		await exportFile(outputPath, async (temporaryPath) => {
			expect(path.basename(temporaryPath)).toBe('asset.png')
			await writeFile(temporaryPath, 'exported')
		})

		expect(readFileSync(outputPath, 'utf8')).toBe('exported')
		expect(readdirSync(directory)).toEqual(['asset.png'])
	})

	it('should preserve the existing file and its timestamps when contents match', async () => {
		// Span multiple stream chunks to exercise the full file comparison.
		const contents = Buffer.alloc(256 * 1024, 42)
		writeFileSync(outputPath, contents)
		const oldDate = new Date('2000-01-01T00:00:00Z')
		utimesSync(outputPath, oldDate, oldDate)
		const before = statSync(outputPath, { bigint: true })

		await exportFile(outputPath, async (temporaryPath) => {
			await writeFile(temporaryPath, contents)
		})

		const after = statSync(outputPath, { bigint: true })
		expect(after.ino).toBe(before.ino)
		expect(after.birthtimeNs).toBe(before.birthtimeNs)
		expect(after.mtimeNs).toBe(before.mtimeNs)
		expect(after.ctimeNs).toBe(before.ctimeNs)
		expect(readFileSync(outputPath)).toEqual(contents)
		expect(readdirSync(directory)).toEqual(['asset.png'])
	})

	it.each(['modified', 'a longer export'])(
		'should replace different contents: %s',
		async (contents) => {
			writeFileSync(outputPath, 'original')
			await exportFile(outputPath, async (temporaryPath) => {
				await writeFile(temporaryPath, contents)
			})

			expect(readFileSync(outputPath, 'utf8')).toBe(contents)
			expect(readdirSync(directory)).toEqual(['asset.png'])
		},
	)

	it('should notice a difference near the end of a large file', async () => {
		const contents = Buffer.alloc(256 * 1024, 42)
		writeFileSync(outputPath, contents)
		contents[contents.length - 1] = 43
		await exportFile(outputPath, async (temporaryPath) => {
			await writeFile(temporaryPath, contents)
		})

		expect(readFileSync(outputPath)).toEqual(contents)
	})

	it('should preserve the existing asset and clean up when exporting fails', async () => {
		writeFileSync(outputPath, 'original')
		const before = statSync(outputPath, { bigint: true })
		const failure = new Error('Export failed')
		await expect(
			exportFile(outputPath, async (temporaryPath) => {
				await writeFile(temporaryPath, 'partial export')
				throw failure
			}),
		).rejects.toBe(failure)

		expect(statSync(outputPath, { bigint: true })).toEqual(before)
		expect(readFileSync(outputPath, 'utf8')).toBe('original')
		expect(readdirSync(directory)).toEqual(['asset.png'])
	})

	it('should clean up when the exporter produces no output', async () => {
		writeFileSync(outputPath, 'original')
		const writeNothing = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
		await expect(exportFile(outputPath, writeNothing)).rejects.toThrow()
		expect(readFileSync(outputPath, 'utf8')).toBe('original')
		expect(readdirSync(directory)).toEqual(['asset.png'])
	})
})
