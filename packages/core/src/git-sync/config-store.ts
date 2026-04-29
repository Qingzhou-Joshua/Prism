import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { GitSyncConfig, SyncStatus, SyncState } from '@prism/shared'

export class GitSyncConfigStore {
  private readonly configPath: string

  constructor(configPath?: string) {
    this.configPath = configPath ?? join(homedir(), '.prism', 'git-sync-config.json')
  }

  async load(): Promise<GitSyncConfig | null> {
    try {
      const raw = await readFile(this.configPath, 'utf-8')
      return JSON.parse(raw) as GitSyncConfig
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async save(config: GitSyncConfig): Promise<void> {
    await mkdir(join(this.configPath, '..'), { recursive: true })
    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  async clear(): Promise<void> {
    try {
      await unlink(this.configPath)
    } catch {
      // ignore if not exists
    }
  }

  async getStatus(): Promise<SyncState> {
    const config = await this.load()
    return {
      status: config ? 'synced' : 'idle',
      lastSyncAt: config?.lastSyncAt,
    }
  }

  async updateStatus(status: SyncStatus, _message?: string): Promise<void> {
    const config = await this.load()
    if (!config) return
    const updated: GitSyncConfig = {
      ...config,
      lastSyncAt: new Date().toISOString(),
      // Store the status in lastSyncAt so callers can observe it changed;
      // GitSyncConfig doesn't carry a separate status field by design.
    }
    // Ignore status param — GitSyncConfig has no status field; lastSyncAt is updated.
    void status
    await this.save(updated)
  }
}
