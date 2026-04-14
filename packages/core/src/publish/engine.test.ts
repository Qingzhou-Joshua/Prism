import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PublishEngine } from './engine.js'
import type { UnifiedRule, UnifiedSkill, UnifiedAgent, PlatformId } from '@prism/shared'
import type { RuleStore } from '../rules/store.js'
import type { ProfileStore } from '../profiles/store.js'
import type { SkillStore } from '../skills/store.js'
import type { AgentStore } from '../agents/store.js'

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

function makeSkillStore(skills: UnifiedSkill[]): SkillStore {
  return {
    async list() { return skills },
    async get(id: string) { return skills.find(s => s.id === id) ?? null },
    async create(_dto: unknown) { throw new Error('not implemented') },
    async update(_id: string, _dto: unknown) { throw new Error('not implemented') },
    async delete(_id: string) { throw new Error('not implemented') },
  } as unknown as SkillStore
}

function makeAgentStore(agents: UnifiedAgent[]): AgentStore {
  return {
    async list() { return agents },
    async get(id: string) { return agents.find(a => a.id === id) ?? null },
    async create(_dto: unknown) { throw new Error('not implemented') },
    async update(_id: string, _dto: unknown) { throw new Error('not implemented') },
    async delete(_id: string) { throw new Error('not implemented') },
    async importAgents(_imported: unknown) { throw new Error('not implemented') },
  } as unknown as AgentStore
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

const SKILL_1: UnifiedSkill = {
  id: 'skill-1',
  name: 'My Skill',
  content: 'skill content here',
  tags: [],
  targetPlatforms: ['claude-code' as PlatformId],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const AGENT_1: UnifiedAgent = {
  id: 'agent-1',
  name: 'Code Reviewer',
  content: 'agent content here',
  tags: [],
  targetPlatforms: ['claude-code' as PlatformId],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const PROFILE_1 = {
  id: 'profile-1',
  name: 'My Profile',
  ruleIds: ['rule-1'],
  skillIds: [] as string[],
  agentIds: [] as string[],
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

  // ---- Skill publishing tests ----

  it('writes a skill file with skillId and skillName tracked', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()
    const skillsDir = await makeTmp()

    const profileWithSkill = { ...PROFILE_1, ruleIds: [], skillIds: ['skill-1'] }

    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithSkill]),
      prismDir,
      () => platformDir,
      makeSkillStore([SKILL_1]),
      () => skillsDir,
    )

    const revision = await engine.publish('profile-1')

    expect(revision.files).toHaveLength(1)
    const pf = revision.files[0]
    expect(pf.isNew).toBe(true)
    expect(pf.backupPath).toBeUndefined()
    expect(pf.skillId).toBe('skill-1')
    expect(pf.skillName).toBe('My Skill')
    expect(pf.ruleId).toBeUndefined()

    const written = await readFile(pf.filePath, 'utf-8')
    expect(written).toBe('skill content here')
  })

  it('backs up existing skill file before overwrite', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()
    const skillsDir = await makeTmp()

    // pre-create the target skill file
    const targetPath = join(skillsDir, 'my-skill.md')
    await writeFile(targetPath, 'old skill content')

    const profileWithSkill = { ...PROFILE_1, ruleIds: [], skillIds: ['skill-1'] }

    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithSkill]),
      prismDir,
      () => platformDir,
      makeSkillStore([SKILL_1]),
      () => skillsDir,
    )

    const revision = await engine.publish('profile-1')

    const pf = revision.files[0]
    expect(pf.isNew).toBe(false)
    expect(pf.backupPath).toBeDefined()

    const backup = await readFile(pf.backupPath!, 'utf-8')
    expect(backup).toBe('old skill content')

    const written = await readFile(pf.filePath, 'utf-8')
    expect(written).toBe('skill content here')
  })

  it('skips missing skill IDs silently', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()
    const skillsDir = await makeTmp()

    const profileWithMissingSkill = { ...PROFILE_1, ruleIds: [], skillIds: ['nonexistent-skill'] }

    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithMissingSkill]),
      prismDir,
      () => platformDir,
      makeSkillStore([SKILL_1]),
      () => skillsDir,
    )

    const revision = await engine.publish('profile-1')
    expect(revision.files).toHaveLength(0)
  })

  it('skips platforms that do not support skills (getPlatformSkillsDir throws)', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()

    const profileWithSkill = {
      ...PROFILE_1,
      ruleIds: [],
      skillIds: ['skill-1'],
      targetPlatforms: ['claude-code' as PlatformId, 'openclaw' as PlatformId],
    }

    // Only claude-code has a skills dir; openclaw throws
    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithSkill]),
      prismDir,
      () => platformDir,
      makeSkillStore([SKILL_1]),
      (platformId) => {
        if (platformId === 'claude-code') return platformDir
        throw new Error(`Platform ${platformId} does not support skills`)
      },
    )

    const revision = await engine.publish('profile-1')
    // Only claude-code writes a skill file; openclaw is skipped
    expect(revision.files).toHaveLength(1)
    expect(revision.files[0].platformId).toBe('claude-code')
    expect(revision.files[0].skillId).toBe('skill-1')
  })

  it('writes both rules and skills in one publish', async () => {
    const prismDir = await makeTmp()
    const rulesDir = await makeTmp()
    const skillsDir = await makeTmp()

    const profileWithBoth = {
      ...PROFILE_1,
      ruleIds: ['rule-1'],
      skillIds: ['skill-1'],
    }

    const engine = new PublishEngine(
      makeRuleStore([RULE_1]),
      makeProfileStore([profileWithBoth]),
      prismDir,
      () => rulesDir,
      makeSkillStore([SKILL_1]),
      () => skillsDir,
    )

    const revision = await engine.publish('profile-1')
    expect(revision.files).toHaveLength(2)

    const ruleFile = revision.files.find(f => f.ruleId !== undefined)
    const skillFile = revision.files.find(f => f.skillId !== undefined)
    expect(ruleFile).toBeDefined()
    expect(skillFile).toBeDefined()
    expect(ruleFile!.ruleId).toBe('rule-1')
    expect(skillFile!.skillId).toBe('skill-1')
  })

  // ---- Agent publishing tests ----

  it('writes an agent file with agentId and agentName tracked', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()
    const agentsDir = await makeTmp()

    const profileWithAgent = { ...PROFILE_1, ruleIds: [], agentIds: ['agent-1'] }

    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithAgent]),
      prismDir,
      () => platformDir,
      null,
      () => { throw new Error('no skills') },
      makeAgentStore([AGENT_1]),
      () => agentsDir,
    )

    const revision = await engine.publish('profile-1')

    expect(revision.files).toHaveLength(1)
    const pf = revision.files[0]
    expect(pf.isNew).toBe(true)
    expect(pf.backupPath).toBeUndefined()
    expect(pf.agentId).toBe('agent-1')
    expect(pf.agentName).toBe('Code Reviewer')
    expect(pf.ruleId).toBeUndefined()
    expect(pf.skillId).toBeUndefined()

    const written = await readFile(pf.filePath, 'utf-8')
    expect(written).toBe('agent content here')
  })

  it('backs up existing agent file before overwrite', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()
    const agentsDir = await makeTmp()

    // pre-create the target agent file
    const targetPath = join(agentsDir, 'code-reviewer.md')
    await writeFile(targetPath, 'old agent content')

    const profileWithAgent = { ...PROFILE_1, ruleIds: [], agentIds: ['agent-1'] }

    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithAgent]),
      prismDir,
      () => platformDir,
      null,
      () => { throw new Error('no skills') },
      makeAgentStore([AGENT_1]),
      () => agentsDir,
    )

    const revision = await engine.publish('profile-1')

    const pf = revision.files[0]
    expect(pf.isNew).toBe(false)
    expect(pf.backupPath).toBeDefined()

    const backup = await readFile(pf.backupPath!, 'utf-8')
    expect(backup).toBe('old agent content')

    const written = await readFile(pf.filePath, 'utf-8')
    expect(written).toBe('agent content here')
  })

  it('skips missing agent IDs silently', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()
    const agentsDir = await makeTmp()

    const profileWithMissingAgent = { ...PROFILE_1, ruleIds: [], agentIds: ['nonexistent-agent'] }

    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithMissingAgent]),
      prismDir,
      () => platformDir,
      null,
      () => { throw new Error('no skills') },
      makeAgentStore([AGENT_1]),
      () => agentsDir,
    )

    const revision = await engine.publish('profile-1')
    expect(revision.files).toHaveLength(0)
  })

  it('skips platforms that do not support agents (getAgentsDir returns null)', async () => {
    const prismDir = await makeTmp()
    const platformDir = await makeTmp()
    const agentsDir = await makeTmp()

    const profileWithAgent = {
      ...PROFILE_1,
      ruleIds: [],
      agentIds: ['agent-1'],
      targetPlatforms: ['claude-code' as PlatformId, 'cursor' as PlatformId],
    }

    // claude-code returns a dir; cursor returns null
    const engine = new PublishEngine(
      makeRuleStore([]),
      makeProfileStore([profileWithAgent]),
      prismDir,
      () => platformDir,
      null,
      () => { throw new Error('no skills') },
      makeAgentStore([AGENT_1]),
      (platformId) => platformId === 'claude-code' ? agentsDir : null,
    )

    const revision = await engine.publish('profile-1')
    // Only claude-code writes an agent file; cursor is skipped
    expect(revision.files).toHaveLength(1)
    expect(revision.files[0].platformId).toBe('claude-code')
    expect(revision.files[0].agentId).toBe('agent-1')
  })
})
