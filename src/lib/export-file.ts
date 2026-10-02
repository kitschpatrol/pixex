import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { log } from './log'
import { isRecord } from './validate'

async function hashFile(filePath: string): Promise<string> {
	const hash = createHash('sha256')
	await pipeline(createReadStream(filePath), hash)
	return hash.digest('hex')
}

async function filesMatch(exportPath: string, outputPath: string): Promise<boolean> {
	try {
		const [exported, existing] = await Promise.all([stat(exportPath), stat(outputPath)])
		if (!existing.isFile() || existing.size !== exported.size) {
			return false
		}

		// Stream the files so large image and video exports do not fill memory.
		const [exportHash, existingHash] = await Promise.all([
			hashFile(exportPath),
			hashFile(outputPath),
		])
		return exportHash === existingHash
	} catch (error) {
		if (isRecord(error) && error.code === 'ENOENT') {
			return false
		}

		throw error
	}
}

/**
 * Export beside the destination, then replace it only when the contents differ.
 * Keeping the original file preserves its creation and modification dates.
 */
export async function exportFile(
	outputPath: string,
	writeExport: (temporaryPath: string) => Promise<unknown>,
): Promise<void> {
	const temporaryDirectory = await mkdtemp(path.join(path.dirname(outputPath), '.pixex-'))
	try {
		// Keep the requested filename and extension for Pixelmator's exporter.
		const temporaryPath = path.join(temporaryDirectory, path.basename(outputPath))
		await writeExport(temporaryPath)
		if (await filesMatch(temporaryPath, outputPath)) {
			log.debug(`Unchanged, leaving ${outputPath} untouched`)
			return
		}

		await rename(temporaryPath, outputPath)
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true })
	}
}
