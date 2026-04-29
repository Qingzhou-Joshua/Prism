import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type {
  Registry,
  RegistryEntry,
  GitConflict,
  GitConflictResolution,
  GitInitResult,
  PrePullCheck,
  SyncState,
  ConflictResolution,
} from '@prism/shared'
import type { GitSyncStore } from './git-sync-store.js'
import type { RegistryStore } from '../registry/registry-store.js'
import type { OverrideStore } from '../overrides/override-store.js'
import type { KnowledgeStore } from '../knowledge/knowledge-store.js'
import { createExportPackage, extractExportPackage } from './export-package.js'
import { computeChecksum } from '../registry/registry-store.js'

type AssetTypeStr = RegistryEntry['type']

function normalizeKey(type: AssetTypeStr, name: string): string {
  return `${type}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

const PRISM_GIT_WORK_DIR = join(homedir(), '.prism', 'git-sync')

export class GitSyncService {
  constructor(
    private readonly gitStore: GitSyncStore,
    private readonly registryStore: RegistryStore,
    private readonly overrideStore: OverrideStore,
    private readonly knowledgeStore: KnowledgeStore,
    private readonly machine?: string,
  ) {}

  /**
   * Initialize git sync with a remote URL and branch.
   * If existingRepoPath is provided, clone from there; otherwise init a new repo.
   */
  async initializeSync(
    remoteUrl: string,
    branch: string,
    existingRepoPath?: string,
  ): Promise<GitInitResult> {
    try {
      await mkdir(PRISM_GIT_WORK_DIR, { recursive: true })

      if (existingRepoPath) {
        await this.gitStore.clone(remoteUrl, branch)
        // After clone, we have the remote's registry — extract to ~/.prism
        const localReg = await this.gitStore.getLocalRegistry()
        if (localReg) {
          await this.registryStore.save(localReg)
          return {
            success: true,
            message: 'Cloned and registry loaded from remote.',
            config: { remoteUrl, branch },
            registryRebuilt: true,
          }
        }
        return {
          success: true,
          message: 'Cloned successfully. Remote registry was empty.',
          config: { remoteUrl, branch },
        }
      }

      // Fresh init: create the export package and write it into the work dir
      await this.gitStore.initialize(remoteUrl, branch)
      await this._writeExportToWorkDir()
      await this.gitStore.push('chore: initial prism export')

      return {
        success: true,
        message: 'Git sync initialized and initial export pushed.',
        config: { remoteUrl, branch },
      }
    } catch (err: unknown) {
      return {
        success: false,
        message: String((err as Error).message ?? err),
      }
    }
  }

  /** Check whether there are local changes and/or remote changes before pulling */
  async prePullCheck(): Promise<PrePullCheck> {
    // Fetch remote without merging
    try {
      await this.gitStore.fetch()
    } catch {
      // network unreachable — return conservative result
      return { hasLocalChanges: false, hasRemoteChanges: false, conflictsDetected: [] }
    }

    const gitStatus = await this.gitStore.getStatus()
    const hasLocalChanges = gitStatus.modified.length > 0 || gitStatus.untracked.length > 0

    const localReg = await this.gitStore.getLocalRegistry()
    const remoteReg = await this.gitStore.getRemoteRegistry()

    const hasRemoteChanges =
      remoteReg !== null &&
      localReg !== null &&
      remoteReg.lastUpdated !== localReg.lastUpdated

    let conflictsDetected: GitConflict[] = []
    if (localReg && remoteReg) {
      conflictsDetected = this.detectConflicts(localReg, remoteReg)
    }

    return { hasLocalChanges, hasRemoteChanges, conflictsDetected }
  }

  /** Detect entries that exist in both registries but with different checksums */
  detectConflicts(localRegistry: Registry, remoteRegistry: Registry): GitConflict[] {
    const localMap = new Map<string, RegistryEntry>()
    for (const entry of localRegistry.entries) {
      localMap.set(normalizeKey(entry.type, entry.name), entry)
    }

    const conflicts: GitConflict[] = []
    for (const remoteEntry of remoteRegistry.entries) {
      const key = normalizeKey(remoteEntry.type, remoteEntry.name)
      const localEntry = localMap.get(key)
      if (localEntry && localEntry.checksum !== remoteEntry.checksum) {
        conflicts.push({
          key,
          type: remoteEntry.type,
          name: remoteEntry.name,
          local: localEntry,
          remote: remoteEntry,
        })
      }
    }
    return conflicts
  }

  /**
   * Pull from remote, applying conflict resolutions.
   * Strategy:
   *   1. Stash local changes
   *   2. Pull (merge)
   *   3. Apply conflict resolutions to the registry
   *   4. Write resolved registry back to work dir and commit
   */
  async pull(
    conflictResolutions: GitConflictResolution[],
  ): Promise<{ success: boolean; message?: string }> {
    let stashed = false
    try {
      const hasLocal = (await this.gitStore.getStatus())
      if (hasLocal.modified.length > 0 || hasLocal.untracked.length > 0) {
        await this.gitStore.stash()
        stashed = true
      }

      const localRegBefore = await this.gitStore.getLocalRegistry()
      const remoteReg = await this.gitStore.getRemoteRegistry()

      await this.gitStore.pull()

      // Re-read registry after pull
      let registry = await this.gitStore.getLocalRegistry() ?? { version: '1' as const, entries: [], lastUpdated: new Date().toISOString() }

      // Apply conflict resolutions
      if (conflictResolutions.length > 0 && localRegBefore && remoteReg) {
        registry = this._applyResolutions(registry, localRegBefore, remoteReg, conflictResolutions)
        await this._writeRegistryToWorkDir(registry)
      }

      // Sync pulled content back to ~/.prism/
      await this._syncWorkDirToPrismHome()

      return { success: true }
    } catch (err: unknown) {
      return { success: false, message: String((err as Error).message ?? err) }
    } finally {
      // Always attempt to unstash if we stashed, even on error
      if (stashed) {
        try {
          await this.gitStore.unstash()
        } catch {
          // nothing stashed or conflict — that's OK
        }
      }
    }
  }

  /**
   * Export current ~/.prism state to the git work dir and push.
   */
  async push(message: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this._writeExportToWorkDir()
      await this.gitStore.push(message)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, message: String((err as Error).message ?? err) }
    }
  }

  async resolveConflict(
    key: string,
    resolution: ConflictResolution,
    mergedContent?: string,
  ): Promise<{ success: boolean }> {
    try {
      const localReg = await this.gitStore.getLocalRegistry()
      const remoteReg = await this.gitStore.getRemoteRegistry()
      if (!localReg || !remoteReg) return { success: false }

      const updated = this._applyResolutions(localReg, localReg, remoteReg, [
        { key, resolution, mergedContent },
      ])
      await this._writeRegistryToWorkDir(updated)
      return { success: true }
    } catch {
      return { success: false }
    }
  }

  async getSyncStatus(): Promise<SyncState> {
    try {
      const status = await this.gitStore.getStatus()
      if (status.modified.length > 0 || status.untracked.length > 0) {
        return { status: 'idle', message: `${status.modified.length + status.untracked.length} pending changes` }
      }
      return { status: 'synced' }
    } catch {
      return { status: 'idle' }
    }
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private async _writeExportToWorkDir(): Promise<void> {
    const pkg = await createExportPackage(
      this.registryStore,
      this.overrideStore,
      this.knowledgeStore,
      this.machine,
    )
    await mkdir(PRISM_GIT_WORK_DIR, { recursive: true })
    await writeFile(
      join(PRISM_GIT_WORK_DIR, 'registry.json'),
      JSON.stringify(pkg.registry, null, 2),
      'utf-8',
    )
    // Write overrides as individual files
    for (const [key, content] of Object.entries(pkg.overrides)) {
      const filePath = join(PRISM_GIT_WORK_DIR, 'overrides', `${key}.md`)
      await mkdir(join(filePath, '..'), { recursive: true })
      await writeFile(filePath, content, 'utf-8')
    }
    // Write knowledge entries as individual files
    for (const [key, content] of Object.entries(pkg.knowledge)) {
      const filePath = join(PRISM_GIT_WORK_DIR, 'knowledge', `${key}.md`)
      await mkdir(join(filePath, '..'), { recursive: true })
      await writeFile(filePath, content, 'utf-8')
    }
  }

  private async _writeRegistryToWorkDir(registry: Registry): Promise<void> {
    await mkdir(PRISM_GIT_WORK_DIR, { recursive: true })
    await writeFile(
      join(PRISM_GIT_WORK_DIR, 'registry.json'),
      JSON.stringify(registry, null, 2),
      'utf-8',
    )
  }

  /**
   * Read the pulled PrismExportPackage from the git work dir and write it back
   * to ~/.prism/ so that the local stores reflect the remote state.
   */
  private async _syncWorkDirToPrismHome(): Promise<void> {
    const pkg = await this.gitStore.getExportPackage()
    if (!pkg) return
    const prismHomeDir = join(homedir(), '.prism')
    await extractExportPackage(pkg, prismHomeDir)
  }

  private _applyResolutions(
    currentRegistry: Registry,
    localRegistry: Registry,
    remoteRegistry: Registry,
    resolutions: GitConflictResolution[],
  ): Registry {
    const localMap = new Map<string, RegistryEntry>()
    for (const e of localRegistry.entries) {
      localMap.set(normalizeKey(e.type, e.name), e)
    }
    const remoteMap = new Map<string, RegistryEntry>()
    for (const e of remoteRegistry.entries) {
      remoteMap.set(normalizeKey(e.type, e.name), e)
    }

    const resolvedKeys = new Set(resolutions.map(r => r.key))
    const entries = currentRegistry.entries.filter(
      e => !resolvedKeys.has(normalizeKey(e.type, e.name)),
    )

    for (const res of resolutions) {
      if (res.resolution === 'keep-local') {
        const entry = localMap.get(res.key)
        if (entry) entries.push(entry)
      } else if (res.resolution === 'keep-remote') {
        const entry = remoteMap.get(res.key)
        if (entry) entries.push(entry)
      } else if (res.resolution === 'merge') {
        // Use remote as base and update checksum from mergedContent
        const base = remoteMap.get(res.key) ?? localMap.get(res.key)
        if (base && res.mergedContent) {
          entries.push({
            ...base,
            checksum: computeChecksum(res.mergedContent),
            updatedAt: new Date().toISOString(),
          })
        } else if (base) {
          entries.push(base)
        }
      }
    }

    return {
      version: '1',
      entries,
      lastUpdated: new Date().toISOString(),
    }
  }
}
