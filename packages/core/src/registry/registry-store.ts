import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import type { Registry, RegistryEntry, ConflictGroup, AssetType } from '@prism/shared'
import type { PlatformId } from '@prism/shared'

export function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 12)
}

export class RegistryStore {
  private readonly filePath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(homedir(), '.prism', 'registry.json')
  }

  async load(): Promise<Registry> {
    try {
      const text = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(text) as unknown

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as Record<string, unknown>)['version'] !== '1' ||
        !Array.isArray((parsed as Record<string, unknown>)['entries'])
      ) {
        throw new Error(`Registry at ${this.filePath} has invalid shape`)
      }

      return parsed as Registry
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: '1', entries: [], lastUpdated: new Date().toISOString() }
      }
      if (err instanceof SyntaxError) {
        throw new Error(`Registry at ${this.filePath} is corrupted: ${err.message}`)
      }
      throw err
    }
  }

  async save(registry: Registry): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(registry, null, 2), 'utf-8')
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(fn)
    this.writeQueue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  async upsert(entry: RegistryEntry): Promise<void> {
    return this.enqueue(async () => {
      const registry = await this.load()
      // Use (id, platformId) composite key — same asset name can exist on multiple platforms
      const idx = registry.entries.findIndex(
        e => e.id === entry.id && e.platformId === entry.platformId,
      )
      if (idx !== -1) {
        registry.entries[idx] = entry
      } else {
        registry.entries.push(entry)
      }
      registry.lastUpdated = new Date().toISOString()
      await this.save(registry)
    })
  }

  /** Resets registry to empty. Goes through write queue to avoid concurrent-write corruption. */
  async reset(): Promise<void> {
    return this.enqueue(async () => {
      await this.save({ version: '1', entries: [], lastUpdated: new Date().toISOString() })
    })
  }

  async remove(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const registry = await this.load()
      const idx = registry.entries.findIndex(e => e.id === id)
      if (idx === -1) return false
      registry.entries.splice(idx, 1)
      registry.lastUpdated = new Date().toISOString()
      await this.save(registry)
      return true
    })
  }

  async removeByPlatform(id: string, platformId: string): Promise<boolean> {
    return this.enqueue(async () => {
      const registry = await this.load()
      const idx = registry.entries.findIndex(e => e.id === id && e.platformId === platformId)
      if (idx === -1) return false
      registry.entries.splice(idx, 1)
      registry.lastUpdated = new Date().toISOString()
      await this.save(registry)
      return true
    })
  }

  async findById(id: string): Promise<RegistryEntry | null> {
    const registry = await this.load()
    return registry.entries.find(e => e.id === id) ?? null
  }

  async findByPlatform(platformId: PlatformId): Promise<RegistryEntry[]> {
    const registry = await this.load()
    return registry.entries.filter(e => e.platformId === platformId)
  }

  async list(): Promise<RegistryEntry[]> {
    const registry = await this.load()
    return registry.entries
  }

  async getConflicts(): Promise<ConflictGroup[]> {
    const registry = await this.load()

    // 按 `${type}:${normalizedName}` 分组
    const groups = new Map<string, RegistryEntry[]>()
    for (const entry of registry.entries) {
      const normalizedName = entry.name.toLowerCase().replace(/\s+/g, '-')
      const key = `${entry.type}:${normalizedName}`
      const group = groups.get(key)
      if (group) {
        group.push(entry)
      } else {
        groups.set(key, [entry])
      }
    }

    // 只返回跨平台冲突（2+ 个不同 platformId）
    const conflicts: ConflictGroup[] = []
    for (const [key, entries] of groups) {
      const distinctPlatforms = new Set(entries.map(e => e.platformId))
      if (distinctPlatforms.size >= 2) {
        const first = entries[0]
        conflicts.push({
          key,
          type: first.type as AssetType,
          name: first.name,
          entries,
        })
      }
    }

    return conflicts
  }
}
