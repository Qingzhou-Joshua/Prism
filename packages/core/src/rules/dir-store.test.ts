import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DirRuleStore } from './dir-store.js'

describe('DirRuleStore', () => {
  let tmpDir: string
  let store: DirRuleStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'prism-rule-dir-test-'))
    store = new DirRuleStore(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  // --- list ---

  it('list returns empty array when directory is empty', async () => {
    const rules = await store.list()
    expect(rules).toEqual([])
  })

  it('list returns empty array when directory does not exist', async () => {
    const nonexistent = new DirRuleStore(join(tmpDir, 'no-such-dir'))
    const rules = await nonexistent.list()
    expect(rules).toEqual([])
  })

  it('list reads .md files and returns rules with stable ids', async () => {
    await writeFile(join(tmpDir, 'my-rule.md'), '# My Rule\nNo TODO comments.', 'utf-8')
    const rules = await store.list()
    expect(rules).toHaveLength(1)
    expect(rules[0].name).toBe('my-rule')
    expect(rules[0].content).toBe('# My Rule\nNo TODO comments.')
    expect(rules[0].id).toBeDefined()
    expect(rules[0].createdAt).toBeDefined()
    expect(rules[0].updatedAt).toBeDefined()
  })

  it('list ignores non-.md files', async () => {
    await writeFile(join(tmpDir, 'note.txt'), 'ignored', 'utf-8')
    await writeFile(join(tmpDir, 'rule.md'), '# Rule', 'utf-8')
    const rules = await store.list()
    expect(rules).toHaveLength(1)
  })

  it('list ignores subdirectories', async () => {
    await mkdir(join(tmpDir, 'subdir'))
    await writeFile(join(tmpDir, 'rule.md'), '# Rule', 'utf-8')
    const rules = await store.list()
    expect(rules).toHaveLength(1)
  })

  it('list returns stable id derived from file name (same across calls)', async () => {
    await writeFile(join(tmpDir, 'stable-id.md'), 'content', 'utf-8')
    const [first] = await store.list()
    const [second] = await store.list()
    expect(first.id).toBe(second.id)
  })

  // --- get ---

  it('get returns rule by id', async () => {
    await writeFile(join(tmpDir, 'fetch-me.md'), '# Fetch Me', 'utf-8')
    const [created] = await store.list()
    const found = await store.get(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('fetch-me')
  })

  it('get returns null for unknown id', async () => {
    const result = await store.get('nonexistent-id')
    expect(result).toBeNull()
  })

  // --- create ---

  it('create writes a .md file and returns the rule', async () => {
    const rule = await store.create({
      name: 'New Rule',
      content: 'Do not use var.',
      scope: 'global',
    })
    expect(rule.id).toBeDefined()
    expect(rule.name).toBe('New Rule')
    expect(rule.content).toBe('Do not use var.')
    expect(rule.scope).toBe('global')
    expect(rule.tags).toEqual([])
    expect(rule.createdAt).toBeDefined()
    expect(rule.updatedAt).toBeDefined()
  })

  it('create file is discoverable by list', async () => {
    await store.create({ name: 'Listed Rule', content: 'content', scope: 'global' })
    const rules = await store.list()
    expect(rules).toHaveLength(1)
    expect(rules[0].name).toBe('Listed Rule')
  })

  // --- update ---

  it('update rewrites the .md file with new content', async () => {
    const created = await store.create({ name: 'Old Name', content: 'old', scope: 'global' })
    await new Promise((r) => setTimeout(r, 2))
    const updated = await store.update(created.id, { content: 'new content' })
    expect(updated).not.toBeNull()
    expect(updated!.content).toBe('new content')
    expect(updated!.name).toBe('Old Name')
    expect(updated!.updatedAt).not.toBe(created.updatedAt)
  })

  it('update renames the .md file when name changes', async () => {
    const created = await store.create({ name: 'Old Name', content: 'x', scope: 'global' })
    const updated = await store.update(created.id, { name: 'New Name' })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('New Name')
    // should be findable by new id
    const found = await store.get(updated!.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('New Name')
  })

  it('update returns null for unknown id', async () => {
    const result = await store.update('bad-id', { content: 'x' })
    expect(result).toBeNull()
  })

  // --- delete ---

  it('delete removes the .md file and returns true', async () => {
    const rule = await store.create({ name: 'To Delete', content: 'd', scope: 'global' })
    const result = await store.delete(rule.id)
    expect(result).toBe(true)
    const rules = await store.list()
    expect(rules).toHaveLength(0)
  })

  it('delete returns false for unknown id', async () => {
    const result = await store.delete('no-such-id')
    expect(result).toBe(false)
  })

  // --- cross-instance persistence ---

  it('persists rules across store instances (reads from same directory)', async () => {
    const store1 = new DirRuleStore(tmpDir)
    const rule = await store1.create({ name: 'Persistent', content: 'persisted', scope: 'global' })

    const store2 = new DirRuleStore(tmpDir)
    const found = await store2.get(rule.id)
    expect(found).not.toBeNull()
    expect(found!.content).toBe('persisted')
  })
})
