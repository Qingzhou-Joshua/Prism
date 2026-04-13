import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PublishEngine } from './engine.js'
import type { UnifiedRule, PlatformId } from '@prism/shared'
import type { RuleStore } from '../rules/store.js'
import type { ProfileStore } from '../profiles/store.js'

// ---- in-memory stubs ----

function makeRuleStore(rules: UnifiedRule[]): RuleStore {
  return {
    async list() { return rules },
    async get(id: string) { return rules.find(r => r.id === id) ?? null },
    async create(_dto: unknown) { throw new Error('not implemented') },
    async update(_id: string, _dto: unknown) { throw new Error('not implemented') },
    async delete(_id: string) { throw new Error('not implemented') },
  } as unknown as RuleStore
}

function makeProfileStore(profiles: any[]): ProfileStore {
  return {
    async list() { return profiles },
    async get(id: string) { return profiles.find((p: any) => p.id === id) ?? null },
    async create(_dto: unknown) { throw new Error('not implemented') },
    async update(_id: string, _dto: unknown) { throw new Error('not implemented') },
    async delete(_id: string) { throw new Error('not implemented') },
  } as unknown as ProfileStore
}

// ---- test helpers ----

let tmpDirs: string[] = []
async function makeTmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'prism-engine-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  tmpDirs = []
})

// Sample data
const RULE_1: UnifiedRule = {
  id: 'rule-1',
  name: 'TS Patterns',
  content: 'base content',
  platformOverrides: {},
  tags: [],
  scope: 'global',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const PROFILE_1 = {
  id: 'profile-1',
  name: 'My Profile',
  ruleIds: ['rule-1'],
  targetPlatforms: ['claude-code' as PlatformId],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('PublishEngine', () => {
  it('writes a new file with isNew=true and no backup', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()

    const engine = new PublishEngine(
      makeRuleStore([RULE_1]),
      makeProfileStore([PROFILE_1]),
      prismDir,
      () => platformDir,
    )

    const revision = await engine.publish('profile-1')

    expect(revision.files).toHaveLength(1)
    const pf = revision.files[0]
    expect(pf.isNew).toBe(true)
    expect(pf.backupPath).toBeUndefined()
    expect(pf.ruleId).toBe('rule-1')
    expect(pf.ruleName).toBe('TS Patterns')

    // file written to platform dir
    const written = await readFile(pf.filePath, 'utf-8')
    expect(written).toContain('base content')
  })

  it('backs up an existing file with isNew=false', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()

    // pre-create the target file
    const targetPath = join(platformDir, 'ts-patterns.md')
    await writeFile(targetPath, 'old content')

    const engine = new PublishEngine(
      makeRuleStore([RULE_1]),
      makeProfileStore([PROFILE_1]),
      prismDir,
      () => platformDir,
    )

    const revision = await engine.publish('profile-1')

    const pf = revision.files[0]
    expect(pf.isNew).toBe(false)
    expect(pf.backupPath).toBeDefined()

    // backup exists with old content
    const backup = await readFile(pf.backupPath!, 'utf-8')
    expect(backup).toBe('old content')

    // new content written to target
    const written = await readFile(pf.filePath, 'utf-8')
    expect(written).toContain('base content')
  })

  it('skips missing rule IDs silently', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()

    const profileWithMissingRule = { ...PROFILE_1, ruleIds: ['nonexistent'] }

    const engine = new PublishEngine(
      makeRuleStore([RULE_1]),
      makeProfileStore([profileWithMissingRule]),
      prismDir,
      () => platformDir,
    )

    const revision = await engine.publish('profile-1')
    expect(revision.files).toHaveLength(0)
  })

  it('returns revision with files:[] for empty profile', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()

    const emptyProfile = { ...PROFILE_1, ruleIds: [] as string[], targetPlatforms: [] as PlatformId[] }

    const engine = new PublishEngine(
      makeRuleStore([RULE_1]),
      makeProfileStore([emptyProfile]),
      prismDir,
      () => platformDir,
    )

    const revision = await engine.publish('profile-1')
    expect(revision.profileId).toBe('profile-1')
    expect(revision.files).toHaveLength(0)
  })

  it('throws when profile not found', async () => {
    const prismDir = await makeTmp()
    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([]),
      prismDir,
    )
    await expect(engine.publish('does-not-exist')).rejects.toThrow()
  })

  it('produces 4 files for 2 rules × 2 platforms', async () => {
    const prismDir = await makeTmp()
    const platformDir1 = await makeTmp()
    const platformDir2 = await makeTmp()

    const RULE_2: UnifiedRule = { ...RULE_1, id: 'rule-2', name: 'TS Security' }
    const profile2x2 = {
      ...PROFILE_1,
      ruleIds: ['rule-1', 'rule-2'],
      targetPlatforms: ['claude-code' as PlatformId, 'openclaw' as PlatformId],
    }

    const engine = new PublishEngine(
      makeRuleStore([RULE_1, RULE_2]),
      makeProfileStore([profile2x2]),
      prismDir,
      (platformId) => platformId === 'claude-code' ? platformDir1 : platformDir2,
    )

    const revision = await engine.publish('profile-1')
    expect(revision.files).toHaveLength(4)
  })
})
