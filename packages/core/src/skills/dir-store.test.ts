import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DirSkillStore } from './dir-store.js'

async function writeSkill(dir: string, skillName: string, content: string) {
  const skillDir = join(dir, skillName)
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8')
}

describe('DirSkillStore', () => {
  let tmpDir: string
  let store: DirSkillStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'prism-skill-dir-test-'))
    store = new DirSkillStore(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('list returns empty array when directory is empty', async () => {
    const skills = await store.list()
    expect(skills).toEqual([])
  })

  it('list returns empty array when directory does not exist', async () => {
    const nonexistent = new DirSkillStore(join(tmpDir, 'no-such-dir'))
    const skills = await nonexistent.list()
    expect(skills).toEqual([])
  })

  it('list reads SKILL.md files and parses front matter', async () => {
    const content = `---
name: My Skill
description: A skill
trigger: /my-skill
---
# My Skill Body`
    await writeSkill(tmpDir, 'my-skill', content)
    const skills = await store.list()
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('My Skill')
    expect(skills[0].trigger).toBe('/my-skill')
    expect(skills[0].id).toBeDefined()
  })

  it('list ignores directories without SKILL.md', async () => {
    // A plain file at top level should be ignored
    await writeFile(join(tmpDir, 'note.txt'), 'ignored', 'utf-8')
    // A directory without SKILL.md should be ignored
    await mkdir(join(tmpDir, 'empty-dir'))
    // A valid skill directory
    await writeSkill(tmpDir, 'valid-skill', '---\nname: Valid\n---\nbody')
    const skills = await store.list()
    expect(skills).toHaveLength(1)
  })

  it('list returns stable ids across calls', async () => {
    await writeSkill(tmpDir, 'stable', '---\nname: Stable\n---\nbody')
    const [first] = await store.list()
    const [second] = await store.list()
    expect(first.id).toBe(second.id)
  })

  it('get returns skill by id', async () => {
    await writeSkill(tmpDir, 'fetch-skill', '---\nname: Fetch Skill\n---\nbody')
    const [created] = await store.list()
    const found = await store.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Fetch Skill')
  })

  it('get returns null for unknown id', async () => {
    const result = await store.get('no-id')
    expect(result).toBeNull()
  })

  it('create writes a directory with SKILL.md and returns the skill', async () => {
    const skill = await store.create({
      name: 'New Skill',
      content: 'Do something.',
      trigger: '/new-skill',
    })
    expect(skill.id).toBeDefined()
    expect(skill.name).toBe('New Skill')
    expect(skill.content).toBe('Do something.')
    expect(skill.trigger).toBe('/new-skill')
    expect(skill.createdAt).toBeDefined()
    expect(skill.updatedAt).toBeDefined()
  })

  it('create file is discoverable by list', async () => {
    await store.create({ name: 'Listed Skill', content: 'body', trigger: undefined })
    const skills = await store.list()
    expect(skills).toHaveLength(1)
  })

  it('update rewrites file with new content', async () => {
    const created = await store.create({ name: 'Old Skill', content: 'old', trigger: undefined })
    await new Promise((r) => setTimeout(r, 2))
    const updated = await store.update(created.id, { content: 'new body' })
    expect(updated).not.toBeNull()
    expect(updated!.content).toBe('new body')
    expect(updated!.updatedAt).not.toBe(created.updatedAt)
  })

  it('update returns null for unknown id', async () => {
    const result = await store.update('bad-id', { content: 'x' })
    expect(result).toBeNull()
  })

  it('delete removes directory and returns true', async () => {
    const skill = await store.create({ name: 'Delete Me', content: 'x', trigger: undefined })
    const result = await store.delete(skill.id)
    expect(result).toBe(true)
    expect(await store.list()).toHaveLength(0)
  })

  it('delete returns false for unknown id', async () => {
    const result = await store.delete('no-id')
    expect(result).toBe(false)
  })

  it('persists across store instances', async () => {
    const store1 = new DirSkillStore(tmpDir)
    const skill = await store1.create({ name: 'Persist Skill', content: 'body', trigger: undefined })
    const store2 = new DirSkillStore(tmpDir)
    const found = await store2.get(skill.id)
    expect(found).not.toBeNull()
    expect(found!.content).toBe('body')
  })
})
