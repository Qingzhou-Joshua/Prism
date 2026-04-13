import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FileSkillStore } from './store.js'
import type { CreateSkillDto } from '@prism/shared'

let tmpDir: string
let store: FileSkillStore

const baseDto: CreateSkillDto = {
  name: 'Test Skill',
  description: 'A test skill',
  content: '# Test\nDo something useful.',
  trigger: 'test',
  category: 'testing',
  arguments: ['arg1'],
  tags: ['test'],
  targetPlatforms: ['claude-code'],
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'prism-skills-test-'))
  store = new FileSkillStore(join(tmpDir, 'skills.json'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('FileSkillStore', () => {
  it('returns empty array when file does not exist', async () => {
    const skills = await store.list()
    expect(skills).toEqual([])
  })

  it('creates a skill with id and timestamps', async () => {
    const skill = await store.create(baseDto)
    expect(skill.id).toBeTruthy()
    expect(skill.name).toBe('Test Skill')
    expect(skill.trigger).toBe('test')
    expect(skill.arguments).toEqual(['arg1'])
    expect(skill.createdAt).toBeTruthy()
    expect(skill.updatedAt).toBeTruthy()
  })

  it('lists all created skills', async () => {
    await store.create(baseDto)
    await store.create({ ...baseDto, name: 'Second Skill' })
    const skills = await store.list()
    expect(skills).toHaveLength(2)
  })

  it('gets skill by id', async () => {
    const created = await store.create(baseDto)
    const found = await store.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('returns null for unknown id', async () => {
    const found = await store.get('does-not-exist')
    expect(found).toBeNull()
  })

  it('updates skill fields and updatedAt', async () => {
    const created = await store.create(baseDto)
    const originalUpdatedAt = created.updatedAt

    await new Promise(r => setTimeout(r, 10))

    const updated = await store.update(created.id, { name: 'Updated Name', trigger: 'updated' })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Updated Name')
    expect(updated!.trigger).toBe('updated')
    expect(updated!.updatedAt).not.toBe(originalUpdatedAt)
    expect(updated!.createdAt).toBe(created.createdAt)
  })

  it('returns null when updating non-existent id', async () => {
    const result = await store.update('no-such-id', { name: 'X' })
    expect(result).toBeNull()
  })

  it('deletes existing skill and returns true', async () => {
    const created = await store.create(baseDto)
    const result = await store.delete(created.id)
    expect(result).toBe(true)
    expect(await store.get(created.id)).toBeNull()
  })

  it('returns false when deleting non-existent id', async () => {
    const result = await store.delete('no-such-id')
    expect(result).toBe(false)
  })

  it('persists data across store instances', async () => {
    const created = await store.create(baseDto)

    const store2 = new FileSkillStore(join(tmpDir, 'skills.json'))
    const found = await store2.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Test Skill')
  })
})
