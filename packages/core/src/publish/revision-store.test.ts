import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { FileRevisionStore } from './revision-store.js'
import type { Revision } from '@prism/shared'

let tmpDirs: string[] = []

async function makeTmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'prism-revstore-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  tmpDirs = []
})

function makeRevision(overrides: Partial<Revision> = {}): Revision {
  return {
    id: 'rev-1',
    profileId: 'profile-1',
    profileName: 'My Profile',
    publishedAt: '2026-04-13T10:00:00.000Z',
    files: [],
    ...overrides,
  }
}

describe('FileRevisionStore', () => {
  it('save creates date file for today with the revision in it', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    const rev = makeRevision()
    await store.save(rev)

    const dateFile = join(revisionsDir, '2026-04-13.json')
    const content = JSON.parse(await readFile(dateFile, 'utf-8'))
    expect(content).toHaveLength(1)
    expect(content[0].id).toBe('rev-1')
  })

  it('second save on same day appends to the file', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    await store.save(makeRevision({ id: 'rev-1', publishedAt: '2026-04-13T10:00:00.000Z' }))
    await store.save(makeRevision({ id: 'rev-2', publishedAt: '2026-04-13T14:00:00.000Z' }))

    const dateFile = join(revisionsDir, '2026-04-13.json')
    const content = JSON.parse(await readFile(dateFile, 'utf-8'))
    expect(content).toHaveLength(2)
    expect(content[0].id).toBe('rev-1')
    expect(content[1].id).toBe('rev-2')
  })

  it('get finds a revision by id in a single date file', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    await store.save(makeRevision({ id: 'rev-a' }))
    await store.save(makeRevision({ id: 'rev-b', publishedAt: '2026-04-13T11:00:00.000Z' }))

    const found = await store.get('rev-b')
    expect(found).not.toBeNull()
    expect(found!.id).toBe('rev-b')
  })

  it('get finds a revision across multiple date files', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    await store.save(makeRevision({ id: 'rev-day1', publishedAt: '2026-04-12T10:00:00.000Z' }))
    await store.save(makeRevision({ id: 'rev-day2', publishedAt: '2026-04-13T10:00:00.000Z' }))

    const found = await store.get('rev-day1')
    expect(found).not.toBeNull()
    expect(found!.id).toBe('rev-day1')
  })

  it('get returns null when revision not found', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    await store.save(makeRevision({ id: 'rev-1' }))

    const found = await store.get('nonexistent')
    expect(found).toBeNull()
  })

  it('listAll returns revisions sorted descending by publishedAt', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    await store.save(makeRevision({ id: 'rev-old', publishedAt: '2026-04-11T08:00:00.000Z' }))
    await store.save(makeRevision({ id: 'rev-mid', publishedAt: '2026-04-12T12:00:00.000Z' }))
    await store.save(makeRevision({ id: 'rev-new', publishedAt: '2026-04-13T18:00:00.000Z' }))

    const all = await store.listAll()
    expect(all).toHaveLength(3)
    expect(all[0].id).toBe('rev-new')
    expect(all[1].id).toBe('rev-mid')
    expect(all[2].id).toBe('rev-old')
  })

  it('rollback with isNew=false restores backup file to original path', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    // Set up: backup file exists, target file has new content
    const targetPath = join(tmp, 'platform', 'rules', 'rule.md')
    const backupPath = join(backupsDir, 'rev-rb', 'rule.md')
    await mkdir(dirname(targetPath), { recursive: true })
    await mkdir(dirname(backupPath), { recursive: true })
    await writeFile(targetPath, 'new content')
    await writeFile(backupPath, 'original content')

    const rev = makeRevision({
      id: 'rev-rb',
      files: [
        {
          platformId: 'claude-code',
          filePath: targetPath,
          backupPath,
          isNew: false,
          ruleId: 'rule-1',
          ruleName: 'Test Rule',
        },
      ],
    })
    await store.save(rev)

    await store.rollback('rev-rb')

    const restored = await readFile(targetPath, 'utf-8')
    expect(restored).toBe('original content')
  })

  it('rollback with isNew=true deletes the target file', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    // Set up: target file exists (was created by publish)
    const targetPath = join(tmp, 'platform', 'rules', 'new-rule.md')
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, 'published content')

    const rev = makeRevision({
      id: 'rev-new',
      files: [
        {
          platformId: 'claude-code',
          filePath: targetPath,
          isNew: true,
          ruleId: 'rule-1',
          ruleName: 'New Rule',
        },
      ],
    })
    await store.save(rev)

    await store.rollback('rev-new')

    // File should be deleted
    await expect(readFile(targetPath, 'utf-8')).rejects.toThrow()
  })

  it('rollback with missing backup (isNew=false, no backup file) throws useful error', async () => {
    const tmp = await makeTmp()
    const revisionsDir = join(tmp, 'revisions')
    const backupsDir = join(tmp, 'backups')
    const store = new FileRevisionStore(revisionsDir, backupsDir)

    const targetPath = join(tmp, 'platform', 'rules', 'rule.md')
    const missingBackupPath = join(backupsDir, 'rev-missing', 'rule.md')

    const rev = makeRevision({
      id: 'rev-missing',
      files: [
        {
          platformId: 'claude-code',
          filePath: targetPath,
          backupPath: missingBackupPath,
          isNew: false,
          ruleId: 'rule-1',
          ruleName: 'Test Rule',
        },
      ],
    })
    await store.save(rev)

    await expect(store.rollback('rev-missing')).rejects.toThrow(/backup/)
  })
})
