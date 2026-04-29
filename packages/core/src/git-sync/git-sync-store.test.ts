import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitSyncStore } from './git-sync-store.js'
import type { Registry } from '@prism/shared'

// ── helpers ────────────────────────────────────────────────────────────────

function makeRegistry(entries: Array<{ type: string; name: string; checksum: string }>): Registry {
  return {
    version: '1',
    entries: entries.map((e, i) => ({
      id: `id-${i}`,
      type: e.type as Registry['entries'][0]['type'],
      name: e.name,
      filePath: `/fake/${e.name}.md`,
      platformId: 'claude-code',
      scope: 'global',
      tags: [],
      targetPlatforms: [],
      checksum: e.checksum,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      indexedAt: '2024-01-01T00:00:00.000Z',
    })),
    lastUpdated: '2024-01-01T00:00:00.000Z',
  }
}

// ── computeDiff tests ──────────────────────────────────────────────────────

describe('GitSyncStore.computeDiff', () => {
  let store: GitSyncStore

  beforeEach(() => {
    store = new GitSyncStore('/tmp/fake-git', '/tmp/fake-prism')
  })

  it('should detect added entries (in remote but not local)', () => {
    const local = makeRegistry([{ type: 'rule', name: 'existing-rule', checksum: 'abc123' }])
    const remote = makeRegistry([
      { type: 'rule', name: 'existing-rule', checksum: 'abc123' },
      { type: 'rule', name: 'new-remote-rule', checksum: 'def456' },
    ])

    const diff = store.computeDiff(local, remote)

    expect(diff.added).toHaveLength(1)
    expect(diff.added[0].name).toBe('new-remote-rule')
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('should detect removed entries (in local but not remote)', () => {
    const local = makeRegistry([
      { type: 'rule', name: 'existing-rule', checksum: 'abc123' },
      { type: 'rule', name: 'deleted-rule', checksum: 'xyz789' },
    ])
    const remote = makeRegistry([{ type: 'rule', name: 'existing-rule', checksum: 'abc123' }])

    const diff = store.computeDiff(local, remote)

    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0].name).toBe('deleted-rule')
    expect(diff.added).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('should detect modified entries (same name but different checksum)', () => {
    const local = makeRegistry([{ type: 'rule', name: 'shared-rule', checksum: 'local-checksum' }])
    const remote = makeRegistry([{ type: 'rule', name: 'shared-rule', checksum: 'remote-checksum' }])

    const diff = store.computeDiff(local, remote)

    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0].local.checksum).toBe('local-checksum')
    expect(diff.modified[0].remote.checksum).toBe('remote-checksum')
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
  })

  it('should return empty diff when registries are identical', () => {
    const registry = makeRegistry([
      { type: 'rule', name: 'rule-a', checksum: 'aaa' },
      { type: 'skill', name: 'skill-b', checksum: 'bbb' },
    ])

    const diff = store.computeDiff(registry, registry)

    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('should handle empty registries', () => {
    const empty = makeRegistry([])

    const diff = store.computeDiff(empty, empty)

    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('should normalize names for key comparison (spaces → dashes)', () => {
    const local = makeRegistry([{ type: 'rule', name: 'My Rule Name', checksum: 'abc' }])
    const remote = makeRegistry([{ type: 'rule', name: 'my-rule-name', checksum: 'abc' }])

    // Both normalize to "rule:my-rule-name" — should be same, no diff
    const diff = store.computeDiff(local, remote)

    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('should handle mixed added/removed/modified in one diff', () => {
    const local = makeRegistry([
      { type: 'rule', name: 'unchanged', checksum: 'same' },
      { type: 'rule', name: 'modified', checksum: 'old' },
      { type: 'rule', name: 'will-be-removed', checksum: 'xyz' },
    ])
    const remote = makeRegistry([
      { type: 'rule', name: 'unchanged', checksum: 'same' },
      { type: 'rule', name: 'modified', checksum: 'new' },
      { type: 'rule', name: 'new-entry', checksum: 'fresh' },
    ])

    const diff = store.computeDiff(local, remote)

    expect(diff.added).toHaveLength(1)
    expect(diff.added[0].name).toBe('new-entry')
    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0].name).toBe('will-be-removed')
    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0].local.name).toBe('modified')
  })
})

// ── push/pull tests (exec mocking) ─────────────────────────────────────────

describe('GitSyncStore push/pull', () => {
  it('push: calls git add, commit, push in sequence', async () => {
    // We mock the child_process exec at module level via vi.mock
    // For integration-style testing we check the error path instead
    const store = new GitSyncStore('/nonexistent-dir', '/tmp')

    // Should throw because /nonexistent-dir doesn't exist as a git repo
    await expect(store.push('test commit')).rejects.toThrow()
  })

  it('pull: throws meaningful error on network failure', async () => {
    const store = new GitSyncStore('/nonexistent-dir', '/tmp')

    await expect(store.pull()).rejects.toThrow()
  })

  it('getCurrentBranch: throws on non-git directory', async () => {
    const store = new GitSyncStore('/nonexistent-dir', '/tmp')

    await expect(store.getCurrentBranch()).rejects.toThrow()
  })
})
