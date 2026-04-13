import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileProfileStore } from './store.js'

describe('FileProfileStore', () => {
  let tmpDir: string
  let storePath: string
  let store: FileProfileStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'prism-profiles-test-'))
    storePath = join(tmpDir, 'profiles.json')
    store = new FileProfileStore(storePath)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array when file does not exist', async () => {
    const profiles = await store.list()
    expect(profiles).toEqual([])
  })

  it('create returns a profile with id and timestamps', async () => {
    const profile = await store.create({
      name: 'My Profile',
      ruleIds: ['rule-1'],
      skillIds: [],
      targetPlatforms: ['claude-code'],
    })
    expect(profile.id).toBeTruthy()
    expect(profile.name).toBe('My Profile')
    expect(profile.ruleIds).toEqual(['rule-1'])
    expect(profile.targetPlatforms).toEqual(['claude-code'])
    expect(profile.createdAt).toBeTruthy()
    expect(profile.updatedAt).toBeTruthy()
  })

  it('create sets description to empty string when not provided', async () => {
    const profile = await store.create({
      name: 'Test',
      ruleIds: [],
      skillIds: [],
      targetPlatforms: [],
    })
    expect(profile.description).toBe('')
  })

  it('list returns all created profiles', async () => {
    await store.create({ name: 'A', ruleIds: [], skillIds: [], targetPlatforms: [] })
    await store.create({ name: 'B', ruleIds: [], skillIds: [], targetPlatforms: [] })
    const all = await store.list()
    expect(all).toHaveLength(2)
    expect(all.map((p) => p.name)).toContain('A')
    expect(all.map((p) => p.name)).toContain('B')
  })

  it('get returns profile by id', async () => {
    const created = await store.create({ name: 'Solo', ruleIds: [], skillIds: [], targetPlatforms: [] })
    const found = await store.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('get returns null for unknown id', async () => {
    const found = await store.get('does-not-exist')
    expect(found).toBeNull()
  })

  it('update modifies fields and bumps updatedAt', async () => {
    const created = await store.create({ name: 'Before', ruleIds: [], skillIds: [], targetPlatforms: [] })
    await new Promise((r) => setTimeout(r, 5))
    const updated = await store.update(created.id, { name: 'After', ruleIds: ['r1'] })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('After')
    expect(updated!.ruleIds).toEqual(['r1'])
    expect(updated!.createdAt).toBe(created.createdAt)
    expect(updated!.updatedAt > created.updatedAt).toBe(true)
  })

  it('update returns null for unknown id', async () => {
    const result = await store.update('ghost', { name: 'X' })
    expect(result).toBeNull()
  })

  it('delete removes profile and returns true', async () => {
    const created = await store.create({ name: 'Doomed', ruleIds: [], skillIds: [], targetPlatforms: [] })
    const result = await store.delete(created.id)
    expect(result).toBe(true)
    const all = await store.list()
    expect(all).toHaveLength(0)
  })

  it('delete returns false for unknown id', async () => {
    const result = await store.delete('ghost')
    expect(result).toBe(false)
  })

  it('concurrent creates do not lose writes', async () => {
    await Promise.all([
      store.create({ name: 'C1', ruleIds: [], skillIds: [], targetPlatforms: [] }),
      store.create({ name: 'C2', ruleIds: [], skillIds: [], targetPlatforms: [] }),
      store.create({ name: 'C3', ruleIds: [], skillIds: [], targetPlatforms: [] }),
    ])
    const all = await store.list()
    expect(all).toHaveLength(3)
  })
})
