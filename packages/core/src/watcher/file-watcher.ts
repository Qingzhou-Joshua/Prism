import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import { computeChecksum, RegistryStore } from '../registry/registry-store.js'
import type { WatcherChangeEvent } from '@prism/shared'

const DEBOUNCE_MS = 500
const DEFAULT_SUPPRESS_TTL_MS = 3000

export class FileWatcher extends EventEmitter {
  private readonly store: RegistryStore
  private watchers: Map<string, FSWatcher> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private suppressed: Set<string> = new Set()

  constructor(store: RegistryStore) {
    super()
    this.store = store
  }

  async start(): Promise<void> {
    await this.buildWatchers()
    // 启动后立即检测已有 drift
    await this.detectDrift()
  }

  stop(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
  }

  async refresh(): Promise<void> {
    this.stop()
    await this.buildWatchers()
  }

  suppressNext(filePath: string, ttlMs: number = DEFAULT_SUPPRESS_TTL_MS): void {
    this.suppressed.add(filePath)
    setTimeout(() => {
      this.suppressed.delete(filePath)
    }, ttlMs)
  }

  private async buildWatchers(): Promise<void> {
    const entries = await this.store.list()
    for (const entry of entries) {
      if (this.watchers.has(entry.filePath)) continue
      this.watchFile(entry.filePath)
    }
  }

  private watchFile(filePath: string): void {
    try {
      const watcher = watch(filePath, () => {
        this.scheduleCheck(filePath)
      })
      this.watchers.set(filePath, watcher)
    } catch {
      // 文件不存在或无法监听时静默跳过
    }
  }

  private scheduleCheck(filePath: string): void {
    const existing = this.debounceTimers.get(filePath)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath)
      this.checkFile(filePath).catch(() => {})
    }, DEBOUNCE_MS)
    this.debounceTimers.set(filePath, timer)
  }

  private async checkFile(filePath: string): Promise<void> {
    if (this.suppressed.has(filePath)) return

    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
      throw err
    }

    const entries = await this.store.list()
    const entry = entries.find(e => e.filePath === filePath)
    if (!entry) return

    const currentChecksum = computeChecksum(content)
    if (currentChecksum === entry.checksum) return

    const event: WatcherChangeEvent = {
      entryId: entry.id,
      filePath: entry.filePath,
      platformId: entry.platformId,
      assetType: entry.type,
      assetName: entry.name,
      detectedAt: new Date().toISOString(),
    }
    this.emit('change', event)
  }

  private async detectDrift(): Promise<void> {
    const entries = await this.store.list()
    await Promise.all(entries.map(entry => this.checkFile(entry.filePath)))
  }
}
