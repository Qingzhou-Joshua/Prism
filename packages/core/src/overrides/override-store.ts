import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { PlatformId, AssetType } from '@prism/shared'

/**
 * Stores platform-specific override content at:
 *   ~/.prism/overrides/{platformId}/{assetType}/{id}.md
 *
 * Override files are the ONLY Prism-owned content that doesn't mirror an IDE
 * directory — they represent platform-specific modifications that have no
 * counterpart in the original IDE dirs, so storing them here is safe per the
 * 卸载安全 (uninstall safety) principle.
 */
export class OverrideStore {
  private readonly baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(homedir(), '.prism', 'overrides')
  }

  private overridePath(platformId: PlatformId, assetType: AssetType, id: string): string {
    return join(this.baseDir, platformId, assetType, `${id}.md`)
  }

  /** Returns null if the override doesn't exist. */
  async get(platformId: PlatformId, assetType: AssetType, id: string): Promise<string | null> {
    try {
      return await readFile(this.overridePath(platformId, assetType, id), 'utf-8')
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  /** Creates parent directories as needed, then writes the override content. */
  async set(platformId: PlatformId, assetType: AssetType, id: string, content: string): Promise<void> {
    const filePath = this.overridePath(platformId, assetType, id)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }

  /** Removes the override file. Returns false if it didn't exist, true on success. */
  async delete(platformId: PlatformId, assetType: AssetType, id: string): Promise<boolean> {
    try {
      await unlink(this.overridePath(platformId, assetType, id))
      return true
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw err
    }
  }

  /** Lists all overrides for a given platform + assetType combination. */
  async listForPlatform(
    platformId: PlatformId,
    assetType: AssetType,
  ): Promise<Array<{ id: string; content: string }>> {
    const dir = join(this.baseDir, platformId, assetType)
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }

    const mdFiles = entries.filter((f) => f.endsWith('.md'))
    const results = await Promise.all(
      mdFiles.map(async (fileName) => {
        const id = fileName.slice(0, -3) // strip '.md' (3 chars)
        const content = await readFile(join(dir, fileName), 'utf-8')
        return { id, content }
      }),
    )
    return results
  }
}
