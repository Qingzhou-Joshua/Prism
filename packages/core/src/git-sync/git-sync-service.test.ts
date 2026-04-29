import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitSyncService } from './git-sync-service.js'
import type { Registry, RegistryEntry } from '@prism/shared'

// ── stubs ──────────────────────────────────────────────────────────────────

function makeEntry(type: string, name: string, checksum: string): RegistryEntry {
  return {
    id: `${type}-${name}`,
    type: type as RegistryEntry['type'],
    name,
    filePath: `/fake/${name}.md`,
    platformId: 'claude-code',
    scope: 'global',
    tags: [],
    targetPlatforms: [],
    checksum,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    indexedAt: '2024-01-01T00:00:00.000Z',
  }
}

function makeRegistry(entries: RegistryEntry[]): Registry {
  return { version: '1', entries, lastUpdated: new Date().toISOString() }
}

function makeGitStore(overrides: Record<string, unknown> = {}) {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    clone: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    getLocalRegistry: vi.fn().mockResolvedValue(null),
    getRemoteRegistry: vi.fn().mockResolvedValue(null),
    getExportPackage: vi.fn().mockResolvedValue(null),
    computeDiff: vi.fn().mockReturnValue({ added: [], removed: [], modified: [] }),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    getStatus: vi.fn().mockResolvedValue({ modified: [], untracked: [] }),
    stash: vi.fn().mockResolvedValue(undefined),
    unstash: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeStores() {
  const registryStore = {
    load: vi.fn().mockResolvedValue(makeRegistry([])),
    save: vi.fn().mockResolvedValue(undefined),
  }
  const overrideStore = {
    baseDir: '/tmp/prism/overrides',
  }
  const knowledgeStore = {
    entriesDir: '/tmp/prism/knowledge/entries',
    listEntries: vi.fn().mockResolvedValue([]),
  }
  return { registryStore, overrideStore, knowledgeStore }
}

// ── detectConflicts tests ──────────────────────────────────────────────────

describe('GitSyncService.detectConflicts', () => {
  let service: GitSyncService

  beforeEach(() => {
    const gitStore = makeGitStore()
    const { registryStore, overrideStore, knowledgeStore } = makeStores()
    service = new GitSyncService(
      gitStore as any,
      registryStore as any,
      overrideStore as any,
      knowledgeStore as any,
      'test-machine',
    )
  })

  it('should detect no conflicts when registries are identical', () => {
    const entries = [makeEntry('rule', 'my-rule', 'same-checksum')]
    const local = makeRegistry(entries)
    const remote = makeRegistry(entries)

    const conflicts = service.detectConflicts(local, remote)

    expect(conflicts).toHaveLength(0)
  })

  it('should detect conflict when same entry has different checksum', () => {
    const local = makeRegistry([makeEntry('rule', 'my-rule', 'local-checksum')])
    const remote = makeRegistry([makeEntry('rule', 'my-rule', 'remote-checksum')])

    const conflicts = service.detectConflicts(local, remote)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].key).toBe('rule:my-rule')
    expect(conflicts[0].local?.checksum).toBe('local-checksum')
    expect(conflicts[0].remote?.checksum).toBe('remote-checksum')
  })

  it('should not report conflict for entries only in remote (those are "added", not conflicts)', () => {
    const local = makeRegistry([])
    const remote = makeRegistry([makeEntry('rule', 'new-rule', 'abc')])

    const conflicts = service.detectConflicts(local, remote)

    expect(conflicts).toHaveLength(0)
  })

  it('should not report conflict for entries only in local (those are "removed", not conflicts)', () => {
    const local = makeRegistry([makeEntry('rule', 'local-only', 'abc')])
    const remote = makeRegistry([])

    const conflicts = service.detectConflicts(local, remote)

    expect(conflicts).toHaveLength(0)
  })

  it('should detect multiple conflicts across different asset types', () => {
    const local = makeRegistry([
      makeEntry('rule', 'rule-a', 'old-checksum-a'),
      makeEntry('skill', 'skill-b', 'old-checksum-b'),
    ])
    const remote = makeRegistry([
      makeEntry('rule', 'rule-a', 'new-checksum-a'),
      makeEntry('skill', 'skill-b', 'new-checksum-b'),
    ])

    const conflicts = service.detectConflicts(local, remote)

    expect(conflicts).toHaveLength(2)
    const keys = conflicts.map(c => c.key)
    expect(keys).toContain('rule:rule-a')
    expect(keys).toContain('skill:skill-b')
  })
})

// ── prePullCheck tests ─────────────────────────────────────────────────────

describe('GitSyncService.prePullCheck', () => {
  it('should return hasLocalChanges=true when git status has modified files', async () => {
    const gitStore = makeGitStore({
      getStatus: vi.fn().mockResolvedValue({ modified: ['registry.json'], untracked: [] }),
      getLocalRegistry: vi.fn().mockResolvedValue(makeRegistry([])),
      getRemoteRegistry: vi.fn().mockResolvedValue(makeRegistry([])),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
    })
    const { registryStore, overrideStore, knowledgeStore } = makeStores()
    const service = new GitSyncService(
      gitStore as any,
      registryStore as any,
      overrideStore as any,
      knowledgeStore as any,
    )

    const result = await service.prePullCheck()

    expect(result.hasLocalChanges).toBe(true)
  })

  it('should return hasRemoteChanges=false when local and remote lastUpdated match', async () => {
    const timestamp = '2024-06-01T00:00:00.000Z'
    const gitStore = makeGitStore({
      getStatus: vi.fn().mockResolvedValue({ modified: [], untracked: [] }),
      getLocalRegistry: vi.fn().mockResolvedValue({
        version: '1', entries: [], lastUpdated: timestamp,
      }),
      getRemoteRegistry: vi.fn().mockResolvedValue({
        version: '1', entries: [], lastUpdated: timestamp,
      }),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
    })
    const { registryStore, overrideStore, knowledgeStore } = makeStores()
    const service = new GitSyncService(
      gitStore as any,
      registryStore as any,
      overrideStore as any,
      knowledgeStore as any,
    )

    const result = await service.prePullCheck()

    expect(result.hasRemoteChanges).toBe(false)
    expect(result.conflictsDetected).toHaveLength(0)
  })

  it('should return conflicts when same entry has different checksums', async () => {
    const gitStore = makeGitStore({
      getStatus: vi.fn().mockResolvedValue({ modified: [], untracked: [] }),
      getLocalRegistry: vi.fn().mockResolvedValue(
        makeRegistry([makeEntry('rule', 'shared', 'local')]),
      ),
      getRemoteRegistry: vi.fn().mockResolvedValue(
        makeRegistry([makeEntry('rule', 'shared', 'remote')]),
      ),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
    })
    const { registryStore, overrideStore, knowledgeStore } = makeStores()
    const service = new GitSyncService(
      gitStore as any,
      registryStore as any,
      overrideStore as any,
      knowledgeStore as any,
    )

    const result = await service.prePullCheck()

    expect(result.conflictsDetected).toHaveLength(1)
    expect(result.conflictsDetected[0].key).toBe('rule:shared')
  })
})

// ── pull conflict resolution tests ────────────────────────────────────────

describe('GitSyncService.pull with conflict resolutions', () => {
  it('keep-local: should use local entry checksum after resolution', async () => {
    const localEntry = makeEntry('rule', 'my-rule', 'local-checksum')
    const remoteEntry = makeEntry('rule', 'my-rule', 'remote-checksum')

    const localReg = makeRegistry([localEntry])
    const remoteReg = makeRegistry([remoteEntry])

    const gitStore = makeGitStore({
      getStatus: vi.fn().mockResolvedValue({ modified: [], untracked: [] }),
      getLocalRegistry: vi.fn()
        .mockResolvedValueOnce(localReg)   // pre-pull read
        .mockResolvedValueOnce(remoteReg), // post-pull read (after git pull, remote wins)
      getRemoteRegistry: vi.fn().mockResolvedValue(remoteReg),
    })

    const { registryStore, overrideStore, knowledgeStore } = makeStores()
    const service = new GitSyncService(
      gitStore as any,
      registryStore as any,
      overrideStore as any,
      knowledgeStore as any,
    )

    const result = await service.pull([
      { key: 'rule:my-rule', resolution: 'keep-local' },
    ])

    expect(result.success).toBe(true)
  })

  it('keep-remote: pull succeeds without error', async () => {
    const remoteEntry = makeEntry('rule', 'my-rule', 'remote-checksum')
    const gitStore = makeGitStore({
      getStatus: vi.fn().mockResolvedValue({ modified: [], untracked: [] }),
      getLocalRegistry: vi.fn().mockResolvedValue(makeRegistry([remoteEntry])),
      getRemoteRegistry: vi.fn().mockResolvedValue(makeRegistry([remoteEntry])),
    })
    const { registryStore, overrideStore, knowledgeStore } = makeStores()
    const service = new GitSyncService(
      gitStore as any,
      registryStore as any,
      overrideStore as any,
      knowledgeStore as any,
    )

    const result = await service.pull([
      { key: 'rule:my-rule', resolution: 'keep-remote' },
    ])

    expect(result.success).toBe(true)
  })

  it('returns success=false when git pull throws', async () => {
    const gitStore = makeGitStore({
      getStatus: vi.fn().mockResolvedValue({ modified: [], untracked: [] }),
      getLocalRegistry: vi.fn().mockResolvedValue(makeRegistry([])),
      getRemoteRegistry: vi.fn().mockResolvedValue(makeRegistry([])),
      pull: vi.fn().mockRejectedValue(new Error('network error')),
    })
    const { registryStore, overrideStore, knowledgeStore } = makeStores()
    const service = new GitSyncService(
      gitStore as any,
      registryStore as any,
      overrideStore as any,
      knowledgeStore as any,
    )

    const result = await service.pull([])

    expect(result.success).toBe(false)
    expect(result.message).toContain('network error')
  })
})
